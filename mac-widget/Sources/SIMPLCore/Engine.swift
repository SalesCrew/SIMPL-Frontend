import Foundation

public actor SIMPLEngine {
    public static let shared = SIMPLEngine()
    private let store: SharedStore
    private let sessions: any SessionStore
    private let transport: any HTTPTransport
    private var previewComments: [String: [CardComment]] = [:]
    private var previewAttachments: [String: TaskAttachment] = [:]
    private var previewFiles: [String: URL] = [:]
    private var isPreview: Bool
    public init(store: SharedStore = SharedStore(), sessions: any SessionStore = KeychainSessionStore(accessGroup: SharedLocation.keychainGroup),
                transport: any HTTPTransport = NetworkTransport(), preview: Bool = false) {
        self.store = store; self.sessions = sessions; self.transport = transport; self.isPreview = preview
    }
    private func readPreferences() -> UserPreferences {
        store.preferences()
    }
    public func configuration() -> ServiceConfiguration? { store.configuration() ?? ServiceConfiguration.bundled() }
    public func cached() -> SyncResult { SyncResult(snapshot: store.snapshot(), preferences: readPreferences()) }
    public func configure(_ value: ServiceConfiguration) throws { try store.save(value) }
    public func preview() async throws -> SyncResult {
        isPreview = true
        let snapshot = PreviewData.snapshot()
        try store.save(snapshot)
        return SyncResult(snapshot: snapshot, preferences: readPreferences())
    }
    private func client() throws -> SIMPLClient {
        guard let configuration = configuration() else { throw SIMPLError.notConfigured }
        return SIMPLClient(configuration: configuration, transport: transport, sessions: sessions)
    }
    public func signIn(email: String, password: String) async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let service = try client()
        try await service.signIn(email: email, password: password)
        // Account changes must never keep the previous user's label or alert state.
        try store.save(UserPreferences())
        _ = try store.removePrivateData()
        return await syncLocked(service: service)
    }
    public func signOut() async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        try await sessions.clear()
        try store.save(UserPreferences())
        return SyncResult(snapshot: try store.removePrivateData(), preferences: UserPreferences())
    }
    public func updatePreferences(_ value: UserPreferences, subscriptionsChanged: Bool = false) async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        var value = value
        let latest = readPreferences()
        // Alert and read checkpoints are engine-owned. A UI preference change
        // must not overwrite progress made by another app/widget process.
        value.deliveredActivityIds = latest.deliveredActivityIds
        value.notificationBaselineEstablished = latest.notificationBaselineEstablished
        value.knownApprovedCardIds = latest.knownApprovedCardIds
        value.notificationWorkspaceIds = latest.notificationWorkspaceIds
        value.approvalBaselineEstablished = latest.approvalBaselineEstablished
        value.seenCardUpdates = latest.seenCardUpdates
        value.lastViewedAt = latest.lastViewedAt
        if subscriptionsChanged {
            let snapshot = store.snapshot()
            value.notificationBaselineEstablished = false
            value.approvalBaselineEstablished = false
            value.deliveredActivityIds = Set(snapshot.activities.map(\.id))
            try store.saveAlerts([])
        }
        if value.workspaceId != readPreferences().workspaceId {
            value.filterLabelIds = []
            value.projectId = nil; value.widgetPage = 0
            value.lastViewedAt = nil
        }
        let previousPreferences = readPreferences()
        if value.projectId != previousPreferences.projectId || value.widgetSection != previousPreferences.widgetSection || value.onlyMyCards != previousPreferences.onlyMyCards || value.filterLabelIds != previousPreferences.filterLabelIds { value.widgetPage = 0 }
        try store.save(value)
        if isPreview { return cached() }
        return await syncLocked(service: try client())
    }
    public func sync() async -> SyncResult {
        if isPreview { return cached() }
        do {
            let lease = try await FileLease.acquire(in: store.directory)
            defer { withExtendedLifetime(lease) {} }
            return await syncLocked(service: try client())
        } catch {
            return await handle(error)
        }
    }
    private func syncLocked(service: SIMPLClient) async -> SyncResult {
        do {
            var preferences = readPreferences()
            let snapshot = try await service.loadSnapshot(preferences: preferences)
            let previous = store.snapshot()
            if previous.profile?.id != snapshot.profile?.id {
                preferences.notificationBaselineEstablished = false
                preferences.approvalBaselineEstablished = false; preferences.knownApprovedCardIds = []
                preferences.deliveredActivityIds = []
                preferences.lastViewedAt = nil
                preferences.seenCardUpdates = [:]
                try store.saveAlerts([])
            }
            if let project = preferences.projectId, !snapshot.projects.contains(where: { $0.id == project }) { preferences.projectId = nil; preferences.widgetPage = 0 }
            let alerts = AlertPolicy.evaluate(snapshot: snapshot, preferences: &preferences)
            let pending = store.pendingAlerts()
            try store.saveAlerts(pending + alerts.filter { alert in !pending.contains(where: { $0.id == alert.id }) })
            try store.save(snapshot); try store.save(preferences)
            return SyncResult(snapshot: snapshot, preferences: preferences, alerts: alerts)
        } catch { return await handle(error) }
    }
    public func markViewed() async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let snapshot = store.snapshot()
        guard snapshot.access == .ready else { return cached() }
        return try await reviewCardsLocked(snapshot.visibleCards(.new, preferences: readPreferences()))
    }
    public func markCardRead(_ id: String, through displayedUpdate: Date? = nil) async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let snapshot = store.snapshot()
        guard snapshot.access == .ready, let card = snapshot.cards.first(where: { $0.id == id && $0.isActive }),
              snapshot.workspaces.contains(where: { $0.id == card.workspaceId }) else { throw SIMPLError.missingCard }
        if card.reviewedAt != nil { return cached() }
        if let displayedUpdate, snapshot.lastChange(of: card) > displayedUpdate { throw SIMPLError.confirmationMissing }
        return try await reviewCardsLocked([card])
    }
    private func reviewCardsLocked(_ cards: [TaskCard]) async throws -> SyncResult {
        do {
            let service = isPreview ? nil : try client()
            for card in cards {
                var snapshot = store.snapshot()
                guard let index = snapshot.cards.firstIndex(where: { $0.id == card.id }), card.isActive else { throw SIMPLError.missingCard }
                if let service {
                    snapshot.cards[index] = try await service.review(card: card)
                } else {
                    snapshot.cards[index].reviewedAt = Date()
                    snapshot.cards[index].reviewedBy = snapshot.profile?.id
                }
                // Persist each confirmed receipt, including partial bulk success.
                try store.save(snapshot)
            }
            return cached()
        } catch {
            if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }
            throw error
        }
    }
    public func navigateWidget(projectDirection: Int = 0, pageDirection: Int = 0, section: TaskSection? = nil, pageSize: Int = 5, toggleScope: Bool = false) async throws -> SyncResult {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let snapshot = store.snapshot()
        var preferences = readPreferences()
        if let section { preferences.widgetSection = section; preferences.widgetPage = 0 }
        if toggleScope { preferences.onlyMyCards.toggle(); preferences.widgetPage = 0 }
        if projectDirection != 0 {
            let ids: [String?] = [nil] + snapshot.projects.map { Optional($0.id) }
            let current = ids.firstIndex(of: preferences.projectId) ?? 0
            preferences.projectId = ids[(current + projectDirection % ids.count + ids.count) % ids.count]
            preferences.widgetPage = 0
        }
        if pageDirection != 0 {
            let current = snapshot.widgetCards(preferences: preferences, pageSize: max(1, pageSize))
            preferences.widgetPage = min(max(0, current.page + pageDirection), current.pages - 1)
        }
        try store.save(preferences)
        return cached()
    }
    public func comments(cardId: String) async throws -> [CardComment] {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let snapshot = store.snapshot()
        guard snapshot.access == .ready, let card = snapshot.cards.first(where: { $0.id == cardId }),
              snapshot.workspaces.contains(where: { $0.id == card.workspaceId }) else { throw SIMPLError.missingCard }
        if isPreview {
            return previewComments[cardId] ?? [CardComment(id: "preview-comment-\(cardId)", cardId: cardId, authorId: "preview-colleague", body: "Der Entwurf ist bereit. Schau ihn dir in Ruhe an — ich freue mich auf dein Feedback.", createdAt: Date().addingTimeInterval(-2400), authorName: "Anna")]
        }
        do { return try await client().comments(cardId: cardId, workspaceId: card.workspaceId) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func postComment(cardId: String, body: String, submissionId: String, attachmentIds: [String] = []) async throws -> CardComment {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (!text.isEmpty || !attachmentIds.isEmpty), text.utf16.count <= 5000, attachmentIds.count <= 10 else { throw SIMPLError.invalidComment }
        let service: SIMPLClient? = isPreview ? nil : try client()
        let snapshot = if let service { try await service.loadSnapshot(preferences: readPreferences()) } else { store.snapshot() }
        guard let card = snapshot.cards.first(where: { $0.id == cardId && $0.isActive }), let profile = snapshot.profile else { throw SIMPLError.missingCard }
        if isPreview {
            var comments = previewComments[cardId] ?? [CardComment(id: "preview-comment-\(cardId)", cardId: cardId, authorId: "preview-colleague", body: "Der Entwurf ist bereit. Schau ihn dir in Ruhe an — ich freue mich auf dein Feedback.", createdAt: Date().addingTimeInterval(-2400), authorName: "Anna")]
            if let existing = comments.first(where: { $0.id == submissionId }) { return existing }
            let comment = CardComment(id: submissionId, cardId: cardId, authorId: profile.id, body: text, authorName: profile.name, attachmentIds: attachmentIds)
            for id in attachmentIds { previewAttachments[id]?.commentId = submissionId; previewAttachments[id]?.commentDraftId = nil }
            comments.append(comment); previewComments[cardId] = comments
            return comment
        }
        do { return try await service!.postComment(cardId: cardId, workspaceId: card.workspaceId, body: text, submissionId: submissionId, attachmentIds: attachmentIds) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func attachmentDraftDirectory() -> URL { store.directory.appendingPathComponent("AttachmentDrafts") }
    private func attachmentCard(_ id: String) throws -> TaskCard {
        let snapshot = store.snapshot()
        guard snapshot.access == .ready, let card = snapshot.cards.first(where: { $0.id == id }), snapshot.workspaces.contains(where: { $0.id == card.workspaceId }) else { throw SIMPLError.missingCard }
        return card
    }
    public func attachments(cardId: String) async throws -> [TaskAttachment] {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        let card = try attachmentCard(cardId)
        if isPreview { return previewAttachments.values.filter { $0.cardId == cardId && $0.commentDraftId == nil && $0.status == "ready" } }
        do { return try await client().attachments(cardId: cardId, workspaceId: card.workspaceId) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func feedback(cardId: String) async throws -> TaskFeedbackSource {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        return try await feedbackLocked(cardId: cardId)
    }
    private func feedbackLocked(cardId: String) async throws -> TaskFeedbackSource {
        do {
            let card = try attachmentCard(cardId)
            if isPreview {
                let lists = cardId == "preview-1" ? [TaskChecklist(id: "preview-list", name: "Nächste Schritte", items: [
                    .init(id: "a", name: "Prioritäten abstimmen", completed: true),
                    .init(id: "b", name: "Feedback einarbeiten", completed: false)
                ])] : []
                return TaskFeedbackSource(task: TaskFeedback(id: card.id, workspaceId: card.workspaceId, title: card.title, description: card.description, checklists: lists),
                    attachments: previewAttachments.values.filter { $0.cardId == cardId && $0.commentDraftId == nil && $0.status == "ready" }.sorted { $0.id < $1.id },
                    comments: previewComments[cardId] ?? [CardComment(id: "preview-comment-\(cardId)", cardId: cardId, authorId: "preview-colleague", body: "Der Entwurf ist bereit. Schau ihn dir in Ruhe an — ich freue mich auf dein Feedback.", createdAt: card.createdAt, authorName: "Anna")],
                    accountId: store.snapshot().profile!.id, authorizationVersion: 0)
            }
            return try await client().feedback(cardId: cardId, workspaceId: card.workspaceId)
        } catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }

    public func finishFeedback(_ source: TaskFeedbackSource) async throws -> URL? {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        guard try await feedbackLocked(cardId: source.task.id) == source else { throw FeedbackCopyError.changed }
        try Task.checkCancellation()
        guard !source.attachments.isEmpty else { return nil }
        // Codex gives file paste priority over plain text. The accompanying
        // document ensures that one paste retains the prompt as well as files.
        let folder = store.directory.appendingPathComponent("AttachmentCache/FeedbackExports").appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let document = folder.appendingPathComponent("Feedback i got.md")
        guard FileManager.default.createFile(atPath: document.path, contents: Data(source.text().utf8), attributes: [.posixPermissions: 0o600]) else { throw SIMPLError.storage }
        return document
    }
    public func reserveAttachment(cardId: String, filename: String, size: Int64, draftId: String) async throws -> TaskAttachment {
        try FilePolicy.validate(filename: filename, size: size)
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        let card = try attachmentCard(cardId)
        guard card.isActive else { throw SIMPLError.missingCard }
        if isPreview {
            let item = TaskAttachment(id: UUID().uuidString, cardId: cardId, commentDraftId: draftId, uploadedBy: store.snapshot().profile!.id, filename: filename, mimeType: FilePolicy.mime(filename:filename, size:size), sizeBytes:size, objectPath:UUID().uuidString, status:"pending")
            previewAttachments[item.id] = item; return item
        }
        do { return try await client().reserveAttachment(cardId:cardId, workspaceId:card.workspaceId, filename:filename, size:size, draftId:draftId) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func uploadAttachment(_ item: TaskAttachment, file: URL) async throws -> TaskAttachment {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        let card = try attachmentCard(item.cardId)
        guard card.isActive else { throw SIMPLError.missingCard }
        if isPreview {
            var ready = item; ready.status = "ready"; previewAttachments[item.id] = ready
            let folder = store.directory.appendingPathComponent("AttachmentCache").appendingPathComponent(item.id)
            try FileManager.default.createDirectory(at:folder, withIntermediateDirectories:true, attributes:[.posixPermissions:0o700])
            let copy = folder.appendingPathComponent(item.filename)
            try? FileManager.default.removeItem(at:copy); try FileManager.default.copyItem(at:file, to:copy)
            previewFiles[item.id] = copy; return ready
        }
        do { return try await client().uploadAttachment(item, file:file, workspaceId:card.workspaceId) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func discardAttachment(_ item: TaskAttachment) async throws {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        let card = try attachmentCard(item.cardId)
        if isPreview { if previewAttachments[item.id]?.commentDraftId != nil { previewAttachments[item.id] = nil; previewFiles[item.id] = nil }; return }
        do { try await client().discardAttachment(item, workspaceId:card.workspaceId) }
        catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func downloadAttachment(_ item: TaskAttachment) async throws -> URL {
        let lease = try await FileLease.acquire(in: store.directory); defer { withExtendedLifetime(lease) {} }
        do {
        let card = try attachmentCard(item.cardId)
        // Recheck authorization and server metadata before reusing private bytes.
        let visible = isPreview ? previewAttachments.values.filter { $0.cardId == card.id && $0.commentDraftId == nil } : try await client().attachments(cardId:card.id, workspaceId:card.workspaceId)
        guard visible.contains(where: { $0 == item }) else { throw SIMPLError.forbidden }
        try FilePolicy.validate(filename:item.filename,size:item.sizeBytes)
        guard UUID(uuidString:item.id) != nil else { throw SIMPLError.invalidFile }
        let directory = store.directory.appendingPathComponent("AttachmentCache").appendingPathComponent(item.id)
        try FileManager.default.createDirectory(at:directory, withIntermediateDirectories:true, attributes:[.posixPermissions:0o700])
        let target = directory.appendingPathComponent(item.filename)
        if FileManager.default.fileExists(atPath:target.path), Int64((try? target.resourceValues(forKeys:[.fileSizeKey]).fileSize) ?? -1) == item.sizeBytes { return target }
            let temporary: URL
            if isPreview { guard let file = previewFiles[item.id] else { throw SIMPLError.storage }; temporary = file }
            else { temporary = try await client().downloadAttachment(item, workspaceId:card.workspaceId) }
            defer { if !isPreview { try? FileManager.default.removeItem(at:temporary) } }
            try? FileManager.default.removeItem(at:target)
            try FileManager.default.copyItem(at:temporary, to:target)
            try FileManager.default.setAttributes([.posixPermissions:0o600], ofItemAtPath:target.path)
            return target
        } catch { if (error as? SIMPLError)?.clearsPrivateData == true { _ = await handle(error) }; throw error }
    }
    public func pendingAlerts() -> [LocalAlert] {
        guard store.snapshot().access == .ready, readPreferences().notificationsEnabled else { return [] }
        let snapshot = store.snapshot()
        let accessible = Set(snapshot.workspaces.map(\.id))
        return store.pendingAlerts().filter { alert in
            if let workspace = alert.workspaceId { return accessible.contains(workspace) }
            return snapshot.cards.contains { $0.id == alert.cardId && accessible.contains($0.workspaceId) }
        }
    }
    public func acknowledgeAlert(_ id: String) async throws {
        let lease = try await FileLease.acquire(in: store.directory)
        defer { withExtendedLifetime(lease) {} }
        try store.saveAlerts(store.pendingAlerts().filter { $0.id != id })
    }
    private func handle(_ error: Error) async -> SyncResult {
        let failure = error as? SIMPLError ?? .server
        var snapshot = store.snapshot()
        if failure.clearsPrivateData {
            if failure == .signedOut { try? await sessions.clear() }
            snapshot = (try? store.removePrivateData(
                access: failure == .passwordChangeRequired ? .passwordChangeRequired : .signedOut,
                message: failure.errorDescription)) ?? TaskSnapshot()
        } else {
            snapshot.errorMessage = failure.errorDescription
            try? store.save(snapshot)
        }
        return SyncResult(snapshot: snapshot, preferences: readPreferences())
    }
    public func perform(cardId: String, complete: Bool? = nil, start: Bool = false) async -> SyncResult {
        do {
            let lease = try await FileLease.acquire(in: store.directory)
            defer { withExtendedLifetime(lease) {} }
            if isPreview {
                var snapshot = store.snapshot()
                guard let index = snapshot.cards.firstIndex(where: { $0.id == cardId }) else { throw SIMPLError.missingCard }
                let kind: ColumnKind = start ? .work : (complete == true ? .done : .project)
                guard let column = snapshot.columns.first(where: { $0.kind == kind }) else { throw SIMPLError.missingCard }
                snapshot.cards[index].columnId = column.id
                snapshot.cards[index].completedAt = complete == true ? Date() : nil
                snapshot.cards[index].updatedAt = Date(); snapshot.syncedAt = Date()
                snapshot.errorMessage = nil
                try store.save(snapshot)
                return cached()
            }
            let service = try client()
            let fresh = try await service.loadSnapshot(preferences: readPreferences())
            guard let card = fresh.cards.first(where: { $0.id == cardId && $0.isActive && $0.workspaceId == fresh.workspaceId }) else {
                throw SIMPLError.missingCard
            }
            if start {
                if fresh.section(of: card) == .work {
                    try store.save(fresh)
                    return SyncResult(snapshot: fresh, preferences: readPreferences())
                }
                guard fresh.section(of: card) == .new else { throw SIMPLError.confirmationMissing }
                guard let column = fresh.columns.first(where: { $0.kind == .work && $0.workspaceId == card.workspaceId }) else {
                    throw SIMPLError.missingCard
                }
                _ = try await service.start(card: card, workColumn: column)
            } else if let complete {
                try await service.complete(cardId: cardId, completed: complete)
            }
            let confirmed = try await service.loadSnapshot(preferences: readPreferences())
            guard let card = confirmed.cards.first(where: { $0.id == cardId }) else { throw SIMPLError.confirmationMissing }
            if start {
                guard confirmed.section(of: card) == .work else { throw SIMPLError.confirmationMissing }
            } else if let complete {
                guard (confirmed.section(of: card) == .done) == complete else { throw SIMPLError.confirmationMissing }
            }
            try store.save(confirmed)
            return SyncResult(snapshot: confirmed, preferences: readPreferences())
        } catch { return await handle(error) }
    }
}
