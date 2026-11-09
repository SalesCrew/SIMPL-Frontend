import AppKit
import Foundation
import Testing
@testable import SIMPLCore

private actor FeedbackAPI: HTTPTransport {
    var requests: [URLRequest] = []
    var task = TaskFeedback(id: "preview-1", workspaceId: "preview-workspace", title: "Original", description: "Details", checklists: [
        TaskChecklist(id: "list", name: "Review", items: [.init(id: "one", name: "Check image", completed: true)])
    ])
    var items: [TaskAttachment] = []
    var version = 1
    var changeAccess = false
    var missing = false
    func editTitle() { task.title = "Updated" }
    func setRace() { changeAccess = true }
    func removeCard() { missing = true }
    func addFile(_ filename: String) {
        items.append(TaskAttachment(id: UUID().uuidString, cardId: task.id, uploadedBy: "preview-user", filename: filename,
            mimeType: "application/octet-stream", sizeBytes: 7, objectPath: UUID().uuidString))
    }
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        let path = request.url!.path
        let encoder = JSONEncoder(); encoder.keyEncodingStrategy = .convertToSnakeCase; encoder.dateEncodingStrategy = .iso8601
        let data: Data
        if path.hasSuffix("account_access_context") { data = Data(#"{"ready":true}"#.utf8) }
        else if path.hasSuffix("workspace_access_context") {
            if changeAccess { version += 1 }
            let snapshot = PreviewData.snapshot()
            data = try encoder.encode(AccessContext(profile: snapshot.profile, workspaces: snapshot.workspaces,
                revision: AccessRevision(id: "preview-user", authorizationVersion: version, boardVersion: 1)))
        } else if path.hasSuffix("/cards") { data = try encoder.encode(missing ? [] : [task]) }
        else if path.hasSuffix("/comments") { data = Data("[]".utf8) }
        else if path.hasSuffix("/attachments") { data = try encoder.encode(items) }
        else { throw SIMPLError.server }
        return (data, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }
}
private func feedbackSetup(_ api: FeedbackAPI, directory: URL) throws -> (SIMPLClient, SIMPLEngine) {
    let config = try ServiceConfiguration(supabaseURL: URL(string: "https://xqvexzoswhraqicbmckj.supabase.co")!, publishableKey: "sb_publishable_fixture",
        apiURL: URL(string: "https://fixture.example")!, appURL: URL(string: "https://fixture.example")!)
    let sessions = MemorySessionStore(AuthSession(accessToken: "fixture-token", refreshToken: "fixture-refresh", expiresAt: Date().timeIntervalSince1970 + 3600, user: AuthUser(id: "preview-user", email: nil)))
    let store = SharedStore(directory: directory); try store.save(config); try store.save(PreviewData.snapshot())
    return (SIMPLClient(configuration: config, transport: api, sessions: sessions), SIMPLEngine(store: store, sessions: sessions, transport: api))
}

struct FeedbackTests {
    @Test func commentAttachmentsUseTheSameOrderAsTheClipboardWithFileTypes() {
        let time = Date(timeIntervalSince1970: 0)
        let comment = CardComment(id: "comment", cardId: "card", authorId: "user", body: "Hallo\nMehr Feedback", createdAt: time, authorName: "Kilian", attachmentIds: ["two", "three", "excel"])
        func file(_ id: String, _ name: String, commentId: String? = nil) -> TaskAttachment {
            TaskAttachment(id: id, cardId: "card", commentId: commentId, uploadedBy: "user", filename: name, mimeType: "application/octet-stream", sizeBytes: 30_000_000, objectPath: id)
        }
        let source = TaskFeedbackSource(task: TaskFeedback(id: "card", workspaceId: "w", title: "Title", description: nil),
            attachments: [file("two", "Screenshot.png", commentId: "comment"), file("zip", "Archive.zip"), file("one", "CardImage.jpg"), file("three", "Screenshot.gif", commentId: "comment"), file("excel", "Budget.xlsx", commentId: "comment")],
            comments: [comment], accountId: "user", authorizationVersion: 1)
        #expect(source.orderedAttachments.map(\.id) == ["zip", "one", "two", "three", "excel"])
        let text = source.text(timeZone: TimeZone(secondsFromGMT: 0)!)
        #expect(text.contains("kommentar Kilian 01.01.1970 00:00: Hallo\nMehr Feedback (attachment 3: PNG image, attachment 4: GIF image, attachment 5: Excel)"))
        #expect(text.hasSuffix("attachment 5: Excel — Budget.xlsx"))
        #expect(source.attachments.first { $0.id == "zip" }?.feedbackType == "ZIP archive")
        #expect(source.orderedAttachments.filter(\.isFeedbackImage).count == 3)
        #expect(!source.text().contains("Checklist:"))
        let empty = TaskFeedbackSource(task: source.task, attachments: [], accountId: "user", authorizationVersion: 1)
        #expect(!empty.text().contains("Kommentare:"))
    }
    @Test func exactFormatPreservesTextAndOmitsAbsentChecklist() {
        let task = TaskFeedback(id: "c", workspaceId: "w", title: "Name & <tag>", description: "Line one\nLine two")
        #expect(task.text == "Feedback i got:\n\nName:\nName & <tag>\n\nDescription:\nLine one\nLine two")
        #expect(!task.text.contains("Checklist:"))
        #expect(TaskFeedback(id: "c", workspaceId: "w", title: "Title", description: nil).text.hasSuffix("Description:\n"))
    }
    @Test func checklistOrderAndCheckedStateArePreserved() {
        let task = TaskFeedback(id: "c", workspaceId: "w", title: "Title", description: "", checklists: [
            TaskChecklist(id: "b", name: "Second ID, first list", items: [.init(id: "2", name: "Done", completed: true), .init(id: "1", name: "Pending", completed: false)]),
            TaskChecklist(id: "a", name: "Empty list", items: [])
        ])
        #expect(task.text.hasSuffix("Checklist:\nSecond ID, first list\n- [x] Done\n- [ ] Pending\n\nEmpty list"))
    }
    @Test func freshExportUsesCallerAndOnlyReadsTheSelectedTask() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let api = FeedbackAPI(); await api.addFile("design.psd")
        let (client, _) = try feedbackSetup(api, directory: root)
        let source = try await client.feedback(cardId: "preview-1", workspaceId: "preview-workspace")
        #expect(source.task.checklists.first?.items.first?.completed == true)
        #expect(source.attachments.map(\.filename) == ["design.psd"])
        let requests = await api.requests
        #expect(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-token" })
        #expect(requests.filter { !$0.url!.path.contains("rpc/") }.allSatisfy { $0.httpMethod == "GET" })
        let cardRequest = try #require(requests.first { $0.url!.path.hasSuffix("/cards") })
        let query = URLComponents(url: cardRequest.url!, resolvingAgainstBaseURL: false)!.queryItems!
        #expect(query.contains(.init(name: "id", value: "eq.preview-1")))
        #expect(query.contains(.init(name: "workspace_id", value: "eq.preview-workspace")))
        #expect(query.contains(.init(name: "deleted_at", value: "is.null")))
    }
    @Test func editsNewFilesOrAccessChangesPreventFinishingAStaleCopy() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let api = FeedbackAPI(), (_, engine) = try feedbackSetup(api, directory: root)
        let original = try await engine.feedback(cardId: "preview-1")
        await api.editTitle()
        await #expect(throws: FeedbackCopyError.changed) { try await engine.finishFeedback(original) }
        let edited = try await engine.feedback(cardId: "preview-1")
        await api.addFile("archive.zip")
        await #expect(throws: FeedbackCopyError.changed) { try await engine.finishFeedback(edited) }
        await api.setRace()
        await #expect(throws: SIMPLError.accessChanged) { try await engine.feedback(cardId: "preview-1") }
        #expect(await engine.cached().snapshot.access == .signedOut)
    }
    @Test func attachmentExportIncludesPrivatePromptFileAndTextOnlyExportDoesNot() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let api = FeedbackAPI(), (_, engine) = try feedbackSetup(api, directory: root)
        #expect(try await engine.finishFeedback(engine.feedback(cardId: "preview-1")) == nil)
        await api.addFile("image.gif")
        let source = try await engine.feedback(cardId: "preview-1")
        let url = try #require(await engine.finishFeedback(source))
        #expect(url.lastPathComponent == "Feedback i got.md")
        #expect(try String(contentsOf: url, encoding: .utf8) == source.text())
        #expect((try FileManager.default.attributesOfItem(atPath: url.path)[.posixPermissions] as? NSNumber)?.intValue == 0o600)
        _ = try await engine.signOut()
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }
    @Test @MainActor func clipboardKeepsOriginalBytesAndEveryFormatAlongsideText() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let board = NSPasteboard(name: .init("SIMPL-feedback-test-\(UUID().uuidString)")); defer { board.releaseGlobally() }
        var files: [URL] = []
        for name in ["image.gif", "document.pdf", "archive.zip", "video.mov", "design.psd", "unknown.custom"] {
            let file = root.appendingPathComponent(name); try Data([0, 1, 2, 255]).write(to: file); files.append(file)
        }
        let duplicateFolder = root.appendingPathComponent("second-image")
        try FileManager.default.createDirectory(at: duplicateFolder, withIntermediateDirectories: true)
        let duplicate = duplicateFolder.appendingPathComponent("image.gif")
        try Data([0, 1, 2, 255]).write(to: duplicate); files.append(duplicate)
        try TaskClipboard.write(text: TaskClipboard.codexPrompt, files: files, to: board)
        #expect(board.string(forType: .string) == "read the feedback i got md")
        let copied = try #require(board.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL])
        #expect(copied == files)
        for url in copied { #expect(try Data(contentsOf: url) == Data([0, 1, 2, 255])) }
        let count = board.changeCount
        #expect(throws: (any Error).self) { try TaskClipboard.write(text: "Incomplete", files: [root.appendingPathComponent("missing.png")], to: board) }
        #expect(board.changeCount == count)
        #expect(board.string(forType: .string) == "read the feedback i got md")
    }
}
