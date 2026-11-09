import Foundation
import Testing
@testable import SIMPLCore

private actor FixtureAPI: HTTPTransport {
    enum Mode { case normal, forbidden, offline, changingAccess, wrongRefresh, badReceipt, uncertainComment, reviewConflict, wrongReviewReceipt, uncertainReview }
    var mode: Mode = .normal
    var contextReads = 0
    var snapshot = PreviewData.snapshot()
    var requests: [URLRequest] = []
    var comments: [CardComment] = []
    var reviewWrites = 0
    func setMode(_ value: Mode) { mode = value }
    func addComment() {
        snapshot.activities.append(Activity(id: "new-comment", recipientId: "preview-user", actorId: "other",
            workspaceId: "preview-workspace", cardId: "preview-1", eventType: "comment.created", subject: "", createdAt: Date()))
    }
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        if mode == .offline { throw SIMPLError.network }
        let path = request.url!.path
        var status = 200
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        var data = Data("null".utf8)
        if mode == .forbidden { status = 403 }
        else if path.hasSuffix("account_access_context") { data = Data(#"{"ready":true}"#.utf8) }
        else if path.hasSuffix("workspace_access_context") {
            contextReads += 1
            data = try encoder.encode(AccessContext(profile: snapshot.profile, workspaces: snapshot.workspaces,
                revision: AccessRevision(id: "preview-user", authorizationVersion: mode == .changingAccess ? contextReads : 1, boardVersion: 1)))
        } else if path.hasSuffix("/columns") { data = try encoder.encode(snapshot.columns) }
        else if path.hasSuffix("/labels") { data = try encoder.encode(snapshot.labels) }
        else if path.hasSuffix("/comments") {
            if request.httpMethod == "POST" {
                let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
                let id = body["id"] as! String
                if comments.contains(where: { $0.id == id }) { status = 409 }
                else {
                    comments.append(CardComment(id: id, cardId: body["card_id"] as! String, authorId: "preview-user", body: body["body"] as! String, authorName: "Kilian"))
                    if mode == .uncertainComment { throw SIMPLError.network }
                }
            } else {
                let items = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems ?? []
                let id = items.first { $0.name == "id" }?.value?.dropFirst(3)
                let card = items.first { $0.name == "card_id" }?.value?.dropFirst(3)
                data = try encoder.encode(comments.filter { (id == nil || $0.id == String(id!)) && (card == nil || $0.cardId == String(card!)) })
            }
        }
        else if path.hasSuffix("/cards") {
            let items = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems ?? []
            let id = items.first { $0.name == "id" }?.value?.dropFirst(3).description
            let index = snapshot.cards.firstIndex { $0.id == id }
            if request.httpMethod == "PATCH" {
                if mode == .reviewConflict || index == nil || snapshot.cards[index!].reviewedAt != nil { data = Data("[]".utf8) }
                else {
                    let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
                    snapshot.cards[index!].reviewedAt = Date()
                    snapshot.cards[index!].reviewedBy = body["reviewed_by"] as? String
                    reviewWrites += 1
                    if mode == .uncertainReview { throw SIMPLError.network }
                    var receipt = snapshot.cards[index!]
                    if mode == .wrongReviewReceipt { receipt.reviewedBy = "wrong-user" }
                    data = try encoder.encode([receipt])
                }
            } else { data = try encoder.encode(snapshot.cards.filter { id == nil || $0.id == id }) }
        }
        else if path.hasSuffix("/notifications") { data = try encoder.encode(snapshot.activities) }
        else if path.hasSuffix("/token") {
            data = try encoder.encode(AuthSession(accessToken: "fresh-token", refreshToken: "fresh-refresh",
                expiresAt: Date().timeIntervalSince1970 + 3600,
                user: AuthUser(id: mode == .wrongRefresh ? "wrong-user" : "preview-user", email: nil)))
        } else if path.hasSuffix("set_card_completed") {
            let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
            let id = body["p_card"] as! String
            let completed = body["p_completed"] as! Bool
            if let index = snapshot.cards.firstIndex(where: { $0.id == id }) {
                snapshot.cards[index].completedAt = completed ? Date() : nil
                snapshot.cards[index].columnId = completed ? "preview-done" : "preview-project"
            }
        } else if path.hasSuffix("/move") {
            struct Receipt: Encodable { var cards: [TaskCard] }
            if mode == .badReceipt { data = try encoder.encode(Receipt(cards: [])) }
            else {
                let id = request.url!.pathComponents.dropLast().last!
                let index = snapshot.cards.firstIndex(where: { $0.id == id })!
                snapshot.cards[index].columnId = "preview-work"
                data = try encoder.encode(Receipt(cards: snapshot.cards))
            }
        }
        return (data, HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
    }
}
private func config() throws -> ServiceConfiguration {
    try ServiceConfiguration(supabaseURL: URL(string: "https://xqvexzoswhraqicbmckj.supabase.co")!,
        publishableKey: "sb_publishable_fixture_client", apiURL: URL(string: "https://fixture.example")!,
        appURL: URL(string: "https://fixture.example")!)
}
private func sessions(expired: Bool = false) -> MemorySessionStore {
    MemorySessionStore(AuthSession(accessToken: "fixture-token", refreshToken: "fixture-refresh",
        expiresAt: Date().timeIntervalSince1970 + (expired ? -1 : 3600),
        user: AuthUser(id: "preview-user", email: nil)))
}
struct ClientTests {
    @Test func sharedReadUsesTheWebsiteFieldsAndPersistsItsConfirmedReceipt() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory); try store.save(config())
        let api = FixtureAPI()
        let engine = SIMPLEngine(store: store, sessions: sessions(), transport: api)
        _ = await engine.sync()
        let result = try await engine.markCardRead("preview-1")
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).count == 3)
        #expect(result.snapshot.cards.first { $0.id == "preview-1" }?.reviewedBy == "preview-user")
        let request = try #require(await api.requests.last { $0.httpMethod == "PATCH" })
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-token")
        #expect(request.value(forHTTPHeaderField: "Prefer") == "return=representation")
        let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        #expect(body["reviewed_by"] as? String == "preview-user")
        #expect(body["reviewed_at"] as? String != nil)
        let relaunched = SIMPLEngine(store: store, sessions: sessions(), transport: api)
        let cached = await relaunched.cached()
        #expect(cached.snapshot.visibleCards(.new, preferences: cached.preferences).count == 3)
        _ = try await relaunched.markCardRead("preview-1")
        #expect(await api.reviewWrites == 1)
    }
    @Test func uncertainSharedReviewConvergesWithoutDuplicateWrites() async throws {
        let api = FixtureAPI(); await api.setMode(.uncertainReview)
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        let card = PreviewData.snapshot().cards[0]
        await #expect(throws: SIMPLError.network) { try await client.review(card: card) }
        await api.setMode(.normal)
        let confirmed = try await client.review(card: card)
        #expect(confirmed.reviewedAt != nil)
        #expect(await api.reviewWrites == 1)
    }
    @Test func conflictingOrUnverifiedReviewDoesNotHideAnUnreadCard() async throws {
        let api = FixtureAPI()
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        var card = PreviewData.snapshot().cards[0]; card.editRevision = 7
        await api.setMode(.reviewConflict)
        await #expect(throws: SIMPLError.confirmationMissing) { try await client.review(card: card) }
        let request = try #require(await api.requests.first { $0.httpMethod == "PATCH" })
        #expect(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.contains(.init(name: "edit_revision", value: "eq.7")) == true)
        #expect(await api.reviewWrites == 0)
        await api.setMode(.wrongReviewReceipt)
        await #expect(throws: SIMPLError.confirmationMissing) { try await client.review(card: card) }
    }

    @Test func staleStartIntentCannotReorderWorkOrReopenCompletedCard() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        try store.save(config())
        let api = FixtureAPI()
        let engine = SIMPLEngine(store: store, sessions: sessions(), transport: api)
        _ = await engine.sync()
        _ = await engine.perform(cardId: "preview-1", start: true)
        _ = await engine.perform(cardId: "preview-1", start: true)
        #expect(await api.requests.filter { $0.url?.path.hasSuffix("/move") == true }.count == 1)
        _ = await engine.perform(cardId: "preview-1", complete: true)
        let result = await engine.perform(cardId: "preview-1", start: true)
        #expect(result.snapshot.errorMessage != nil)
        #expect(result.snapshot.cards.first { $0.id == "preview-1" }?.completedAt != nil)
        #expect(await api.requests.filter { $0.url?.path.hasSuffix("/move") == true }.count == 1)
    }
    @Test func queryScopeAndVerifiedSnapshot() async throws {
        let api = FixtureAPI()
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        let snapshot = try await client.loadSnapshot(preferences: UserPreferences())
        #expect(snapshot.access == .ready)
        let requests = await api.requests
        let cards = try #require(requests.first { $0.url?.path.hasSuffix("/cards") == true })
        let params = URLComponents(url: cards.url!, resolvingAgainstBaseURL: false)!.queryItems!
        #expect(params.contains(.init(name: "workspace_id", value: "in.(preview-workspace)")))
        #expect(!params.contains(where: { $0.name == "or" || $0.name == "archived_at" }))
        let notification = try #require(requests.first { $0.url?.path.hasSuffix("/notifications") == true })
        #expect(notification.url!.query!.contains("recipient_id=eq.preview-user"))
        #expect(requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-token" })
    }
    @Test func authorizationRaceNeverPublishesMixedSnapshot() async throws {
        let api = FixtureAPI(); await api.setMode(.changingAccess)
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        await #expect(throws: SIMPLError.accessChanged) { try await client.loadSnapshot(preferences: UserPreferences()) }
    }
    @Test func refreshCannotSwitchIdentity() async throws {
        let api = FixtureAPI(); await api.setMode(.wrongRefresh)
        let saved = sessions(expired: true)
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: saved)
        await #expect(throws: SIMPLError.signedOut) { try await client.session() }
        #expect(await saved.load() == nil)
    }
    @Test func completionAndMoveUseExistingContracts() async throws {
        let api = FixtureAPI()
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        try await client.complete(cardId: "preview-1", completed: true)
        var snapshot = try await client.loadSnapshot(preferences: UserPreferences())
        #expect(snapshot.cards.first { $0.id == "preview-1" }?.completedAt != nil)
        try await client.complete(cardId: "preview-1", completed: false)
        snapshot = try await client.loadSnapshot(preferences: UserPreferences())
        let card = try #require(snapshot.cards.first { $0.id == "preview-1" })
        let column = try #require(snapshot.columns.first { $0.kind == .work })
        _ = try await client.start(card: card, workColumn: column)
        let request = try #require(await api.requests.last { $0.url?.path.hasSuffix("/move") == true })
        #expect(request.url?.host == "fixture.example")
        #expect(request.value(forHTTPHeaderField: "apikey") == nil)
        let body = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        #expect(body["column_id"] as? String == column.id)
        #expect(body["before_id"] is NSNull)
        await api.setMode(.badReceipt)
        await #expect(throws: SIMPLError.confirmationMissing) { try await client.start(card: card, workColumn: column) }
    }
    @Test func offlineKeepsCacheButForbiddenClearsIt() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        try store.save(config())
        let api = FixtureAPI()
        let engine = SIMPLEngine(store: store, sessions: sessions(), transport: api)
        let good = await engine.sync()
        #expect(good.snapshot.access == .ready)
        await api.setMode(.offline)
        let offline = await engine.sync()
        #expect(offline.snapshot.cards == good.snapshot.cards)
        #expect(offline.snapshot.errorMessage != nil)
        await api.setMode(.forbidden)
        let forbidden = await engine.sync()
        #expect(forbidden.snapshot.cards.isEmpty)
        #expect(forbidden.snapshot.access == .signedOut)
    }
    @Test func widgetSyncQueuesAlertsUntilAppAcknowledgesDelivery() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        try store.save(config())
        let api = FixtureAPI()
        let engine = SIMPLEngine(store: store, sessions: sessions(), transport: api)
        var result = await engine.sync()
        result.preferences.notificationsEnabled = true
        result.preferences.watchedLabelIds = ["preview-focus"]
        _ = try await engine.updatePreferences(result.preferences, subscriptionsChanged: true)
        await api.addComment()
        _ = await engine.sync()
        #expect(await engine.pendingAlerts().map(\.id) == ["new-comment"])
        _ = await engine.sync()
        #expect(await engine.pendingAlerts().count == 1)
        try await engine.acknowledgeAlert("new-comment")
        #expect(await engine.pendingAlerts().isEmpty)
    }
}

private struct CommentFlowTests {
    @Test func uncertainWriteRetriesReturnOneConfirmedCommentUsingCallerIdentity() async throws {
        let api = FixtureAPI(); await api.setMode(.uncertainComment)
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        let id = UUID().uuidString
        await #expect(throws: SIMPLError.network) { try await client.postComment(cardId: "preview-1", workspaceId: "preview-workspace", body: "  Danke!  ", submissionId: id) }
        let confirmed = try await client.postComment(cardId: "preview-1", workspaceId: "preview-workspace", body: "  Danke!  ", submissionId: id)
        #expect(confirmed.id == id)
        #expect(confirmed.body == "Danke!")
        #expect(await api.comments.count == 1)
        let comments = try await client.comments(cardId: "preview-1", workspaceId: "preview-workspace")
        #expect(comments == [confirmed])
        #expect(await api.requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-token" })
        let insert = try #require(await api.requests.first { $0.url?.path.hasSuffix("/comments") == true && $0.httpMethod == "POST" })
        let body = try JSONSerialization.jsonObject(with: insert.httpBody!) as! [String: Any]
        #expect(body["author_id"] == nil)
    }
    @Test func invalidTextAndInaccessibleWorkspaceNeverPostAndAccessRaceNeverReturnsComments() async throws {
        let api = FixtureAPI()
        let client = SIMPLClient(configuration: try config(), transport: api, sessions: sessions())
        await #expect(throws: SIMPLError.invalidComment) { try await client.postComment(cardId: "preview-1", workspaceId: "preview-workspace", body: "  ", submissionId: UUID().uuidString) }
        await #expect(throws: SIMPLError.forbidden) { try await client.postComment(cardId: "preview-1", workspaceId: "revoked", body: "Text", submissionId: UUID().uuidString) }
        #expect(await api.requests.filter { $0.url?.path.hasSuffix("/comments") == true && $0.httpMethod == "POST" }.isEmpty)
        await api.setMode(.changingAccess)
        await #expect(throws: SIMPLError.accessChanged) { try await client.comments(cardId: "preview-1", workspaceId: "preview-workspace") }
    }
}
