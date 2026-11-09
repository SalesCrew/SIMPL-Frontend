import SwiftUI
import UserNotifications
import WidgetKit
import ServiceManagement
#if SWIFT_PACKAGE
import SIMPLCore
#endif

@MainActor
final class AppModel: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var snapshot = TaskSnapshot()
    @Published var preferences = UserPreferences()
    @Published var section: TaskSection = .all
    @Published var selectedCardId: String?
    @Published var comments: [CardComment] = []
    @Published var attachments: [TaskAttachment] = []
    @Published var commentFiles: [CommentDraftFile] = []
    @Published var filesStaging = false
    @Published var uploadStatus: String?
    @Published var previewURL: URL?
    @Published var fileError: String?
    var fileDrafts: [String: [CommentDraftFile]] = [:]
    var attachmentDraftIds: [String: String] = [:]
    @Published var commentsLoading = false
    @Published var commentSending = false
    @Published var commentError: String?
    @Published var commentDraft = ""
    @Published var commentScrollRequest = UUID()
    @Published var search = ""
    private var pendingReads: [String: Date] = [:]
    private var drafts: [String: String] = [:]
    private var submissions: [String: (text: String, files: [UUID], id: String)] = [:]
    var showMainWindowAction: (() -> Void)?
    private var commentRequest: UUID?
    var selectedCard: TaskCard? { snapshot.cards.first { $0.id == selectedCardId } }
    @Published var busy = false
    @Published var message: String?
    @Published var loginEmail = ""
    @Published var loginPassword = ""
    @Published var loginAtLaunch = SMAppService.mainApp.status == .enabled
    let engine: SIMPLEngine
    let previewMode: Bool
    private var polling: Task<Void, Never>?
    private var refreshActivity: NSObjectProtocol?

    override init() {
        previewMode = ProcessInfo.processInfo.arguments.contains("--preview")
            || Bundle.main.bundleIdentifier == "at.salescrew.simpl.preview"
        if previewMode {
            let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("SIMPL/DesignPreview")
            if ProcessInfo.processInfo.arguments.contains("--reset-preview") {
                try? FileManager.default.removeItem(at: directory)
            }
            engine = SIMPLEngine(store: SharedStore(directory: directory), sessions: MemorySessionStore(), preview: true)
        } else { engine = .shared }
        super.init()
        if !previewMode {
            refreshActivity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "SIMPL-Aufgaben und Mitteilungen alle 30 Sekunden aktuell halten")
        }
        UNUserNotificationCenter.current().delegate = self
        polling = Task {
            if previewMode {
                do { accept(try await engine.preview()) } catch { message = error.localizedDescription }
            } else { await refresh() }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(30)) } catch { return }
                if !previewMode { await refresh() }
            }
        }
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification,
            object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in await self?.refresh() }
            }
    }
    func accept(_ result: SyncResult) {
        let changed = snapshot.cards != result.snapshot.cards || snapshot.columns != result.snapshot.columns || snapshot.labels != result.snapshot.labels
            || snapshot.activities != result.snapshot.activities || snapshot.access != result.snapshot.access || snapshot.workspaceId != result.snapshot.workspaceId
            || preferences != result.preferences
        snapshot = result.snapshot; preferences = result.preferences
        for (id, date) in pendingReads {
            if let index = snapshot.cards.firstIndex(where: { $0.id == id }) {
                snapshot.cards[index].reviewedAt = snapshot.cards[index].reviewedAt ?? date
                snapshot.cards[index].reviewedBy = snapshot.cards[index].reviewedBy ?? snapshot.profile?.id
            }
        }
        if snapshot.access != .ready { closeCard(); drafts = [:]; submissions = [:]; pendingReads = [:]; fileDrafts = [:]; commentFiles = []; attachments = []; attachmentDraftIds = [:]; previewURL = nil }
        else if selectedCardId != nil && selectedCard == nil { closeCard() }
        message = result.snapshot.errorMessage
        if !previewMode && changed { WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks") }
    }
    func refresh() async {
        guard !busy else { return }
        busy = true
        accept(await engine.sync())
        await deliverAlerts()
        busy = false
        if selectedCardId != nil { await loadComments(silent: true) }
    }
    func signIn() async {
        guard !busy else { return }
        busy = true
        let password = loginPassword
        loginPassword = ""
        do { accept(try await engine.signIn(email: loginEmail, password: password)) }
        catch { message = error.localizedDescription }
        busy = false
    }
    func signOut() async {
        guard !busy else { return }
        busy = true
        do {
            accept(try await engine.signOut())
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        } catch { message = error.localizedDescription }
        busy = false
    }
    func perform(_ card: TaskCard, start: Bool = false) async {
        guard !busy else { return }
        busy = true
        accept(await engine.perform(cardId: card.id, complete: start ? nil : snapshot.section(of: card) != .done, start: start))
        busy = false
    }
    func markRead(_ card: TaskCard) async {
        guard pendingReads[card.id] == nil else { return }
        let displayedUpdate = snapshot.lastChange(of: card)
        pendingReads[card.id] = displayedUpdate
        if let index = snapshot.cards.firstIndex(where: { $0.id == card.id }) {
            snapshot.cards[index].reviewedAt = Date()
            snapshot.cards[index].reviewedBy = snapshot.profile?.id
        }
        do {
            let result = try await engine.markCardRead(card.id, through: displayedUpdate)
            pendingReads.removeValue(forKey: card.id)
            accept(result)
        } catch {
            pendingReads.removeValue(forKey: card.id)
            accept(await engine.cached())
            message = error.localizedDescription
        }
    }
    func markViewed() async {
        guard !busy else { return }
        do { accept(try await engine.markViewed()) } catch { accept(await engine.cached()); message = error.localizedDescription }
    }
    func change(_ update: (inout UserPreferences) -> Void, subscriptions: Bool = false) async {
        guard !busy else { return }
        var changed = await engine.cached().preferences; update(&changed)
        if changed.workspaceId != preferences.workspaceId { closeCard(); search = "" }
        if changed.projectId != preferences.projectId { closeCard(); search = "" }
        busy = true
        do { accept(try await engine.updatePreferences(changed, subscriptionsChanged: subscriptions)) }
        catch { message = error.localizedDescription }
        busy = false
    }
    func setNotifications(_ enabled: Bool) async {
        if enabled && !previewMode {
            do {
                let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                guard granted else {
                    message = "Mitteilungen sind in den macOS Systemeinstellungen für SIMPL deaktiviert."
                    return
                }
            } catch { message = error.localizedDescription; return }
        }
        await change({ $0.notificationsEnabled = enabled }, subscriptions: true)
    }
    func testNotification() async {
        guard !previewMode else { return }
        let content = UNMutableNotificationContent()
        content.title = "SIMPL ist bereit"
        content.body = "Neue Karten, Kommentare, Freigaben und Archive erscheinen hier."
        content.sound = .default
        do { try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "simpl-setup-test", content: content, trigger: nil)) }
        catch { message = "Bitte erlaube SIMPL-Mitteilungen in den macOS Systemeinstellungen." }
    }
    private func deliverAlerts() async {
        guard !previewMode, snapshot.access == .ready else { return }
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        for alert in await engine.pendingAlerts() {
            let content = UNMutableNotificationContent()
            content.title = alert.title; content.body = alert.body; content.sound = .default
            content.userInfo = ["workspaceId": alert.workspaceId ?? ""]
            if !alert.cardId.isEmpty { content.userInfo["cardId"] = alert.cardId }
            do {
                try await center.add(UNNotificationRequest(identifier: "simpl-\(alert.id)", content: content, trigger: nil))
                try await engine.acknowledgeAlert(alert.id)
            } catch { message = "Eine Mitteilung wartet auf Zustellung."; break }
        }
    }
    func showMainWindow() {
        showMainWindowAction?()
        NSApp.activate(ignoringOtherApps: true)
    }
    func openCard(_ id: String) async {
        showMainWindow()
        accept(await engine.cached())
        if let previous = selectedCardId { drafts[previous] = commentDraft; fileDrafts[previous] = commentFiles }
        if snapshot.access != .ready { await refresh() }
        guard let card = snapshot.cards.first(where: { $0.id == id }) else { message = "Diese Karte ist nicht mehr verfügbar."; return }
        if card.workspaceId != snapshot.workspaceId {
            await change { $0.workspaceId = card.workspaceId }
        }
        guard snapshot.cards.contains(where: { $0.id == id }) else { return }
        selectedCardId = id; comments = []; attachments = []; commentError = nil; commentDraft = drafts[id] ?? ""; commentFiles = fileDrafts[id] ?? []
        showMainWindow()
        await loadComments()
    }
    func closeCard() {
        if let id = selectedCardId { drafts[id] = commentDraft; fileDrafts[id] = commentFiles }
        selectedCardId = nil; comments = []; attachments = []; commentFiles = []; previewURL = nil; commentError = nil; commentsLoading = false; commentRequest = nil; commentDraft = ""
    }
    func loadComments(silent: Bool = false) async {
        guard let id = selectedCardId, !commentSending else { return }
        let request = UUID(); commentRequest = request
        if !silent { commentsLoading = true }
        do {
            let loaded = try await engine.comments(cardId: id)
            let loadedFiles = try await engine.attachments(cardId: id)
            guard selectedCardId == id, commentRequest == request else { return }
            comments = loaded; attachments = loadedFiles; commentError = nil
        } catch {
            guard selectedCardId == id, commentRequest == request else { return }
            commentError = error.localizedDescription
            if (error as? SIMPLError)?.clearsPrivateData == true { accept(await engine.cached()) }
        }
        if commentRequest == request { commentsLoading = false }
    }
    func sendComment() async {
        guard let id = selectedCardId, !commentSending else { return }
        let text = commentDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (!text.isEmpty || !commentFiles.isEmpty), text.utf16.count <= 5000 else { return }
        let fileIds = commentFiles.map(\.id)
        let submission = submissions[id].flatMap { $0.text == text && $0.files == fileIds ? $0.id : nil } ?? UUID().uuidString
        submissions[id] = (text, fileIds, submission)
        commentSending = true; commentError = nil
        do {
            let attachmentIds = try await uploadCommentFiles(cardId:id)
            uploadStatus = "Kommentar wird gesendet …"
            let receipt = try await engine.postComment(cardId: id, body: text, submissionId: submission, attachmentIds:attachmentIds)
            let loadedFiles = try? await engine.attachments(cardId:id)
            let sentFiles = fileDrafts[id] ?? commentFiles
            for file in sentFiles { try? FileManager.default.removeItem(at:file.url.deletingLastPathComponent()) }
            fileDrafts[id] = nil; attachmentDraftIds[id] = nil
            submissions[id] = nil; drafts[id] = nil
            if selectedCardId == id {
                commentFiles = []; attachments = loadedFiles ?? attachments
                if !comments.contains(where: { $0.id == receipt.id }) { comments.append(receipt) }
                commentScrollRequest = UUID()
                if commentDraft.trimmingCharacters(in: .whitespacesAndNewlines) == text { commentDraft = "" }
            }
        } catch {
            if selectedCardId == id { commentError = error.localizedDescription }
            if (error as? SIMPLError)?.clearsPrivateData == true { accept(await engine.cached()) }
        }
        commentSending = false; uploadStatus = nil
        if selectedCardId != nil && selectedCardId != id { await loadComments() }
    }
    func openCardInWeb(_ id: String) async {
        guard !previewMode, let config = await engine.configuration() else { return }
        NSWorkspace.shared.open(config.cardURL(id))
    }
    func openWeb() async {
        if let config = await engine.configuration() { NSWorkspace.shared.open(config.appURL) }
    }
    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            loginAtLaunch = SMAppService.mainApp.status == .enabled
            if SMAppService.mainApp.status == .requiresApproval {
                message = "Bitte SIMPL unter Systemeinstellungen → Allgemein → Anmeldeobjekte erlauben."
            }
        } catch { message = "Anmeldeobjekt konnte nicht geändert werden: \(error.localizedDescription)" }
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse) async {
        guard let id = response.notification.request.content.userInfo["cardId"] as? String else { await showMainWindow(); return }
        await openCard(id)
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
        willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }
}
