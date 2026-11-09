import Foundation

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
    func upload(_ request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse)
    func download(_ request: URLRequest) async throws -> (URL, HTTPURLResponse)
}
public extension HTTPTransport {
    func upload(_ request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse) {
        var request = request; request.httpBody = try Data(contentsOf: file); return try await send(request)
    }
    func download(_ request: URLRequest) async throws -> (URL, HTTPURLResponse) {
        let (data, response) = try await send(request)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try data.write(to: file); return (file, response)
    }
}
public struct NetworkTransport: HTTPTransport {
    public init() {}
    public func upload(_ request: URLRequest, file: URL) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await URLSession.shared.upload(for: request, fromFile: file)
        guard let http = response as? HTTPURLResponse else { throw SIMPLError.server }
        return (data, http)
    }
    public func download(_ request: URLRequest) async throws -> (URL, HTTPURLResponse) {
        let (url, response) = try await URLSession.shared.download(for: request)
        guard let http = response as? HTTPURLResponse else { throw SIMPLError.server }
        return (url, http)
    }
    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw SIMPLError.server }
            return (data, http)
        } catch let error as SIMPLError { throw error }
        catch { throw SIMPLError.network }
    }
}

public actor SIMPLClient {
    public let configuration: ServiceConfiguration
    let transport: any HTTPTransport
    let sessions: any SessionStore
    public init(configuration: ServiceConfiguration, transport: any HTTPTransport = NetworkTransport(),
                sessions: any SessionStore) {
        self.configuration = configuration; self.transport = transport; self.sessions = sessions
    }
    public func signIn(email: String, password: String) async throws {
        try configuration.validate()
        let body = try JSONSerialization.data(withJSONObject: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password])
        let data = try await send(path: "auth/v1/token", query: [.init(name: "grant_type", value: "password")],
                                  method: "POST", body: body, token: nil, authentication: true)
        let session = try WireJSON.decoder().decode(AuthSession.self, from: data)
        try await sessions.save(session)
    }
    public func signOut() async throws {
        // Local logout intentionally leaves the user's other SIMPL sessions intact.
        try await sessions.clear()
    }
    public func session() async throws -> AuthSession {
        guard let existing = try await sessions.load() else { throw SIMPLError.signedOut }
        if !existing.requiresRefresh { return existing }
        let body = try JSONSerialization.data(withJSONObject: ["refresh_token": existing.refreshToken])
        do {
            let data = try await send(path: "auth/v1/token", query: [.init(name: "grant_type", value: "refresh_token")],
                                      method: "POST", body: body, token: nil, authentication: true)
            let fresh = try WireJSON.decoder().decode(AuthSession.self, from: data)
            guard fresh.user.id == existing.user.id else {
                try await sessions.clear()
                throw SIMPLError.signedOut
            }
            try await sessions.save(fresh)
            return fresh
        } catch SIMPLError.invalidCredentials {
            try await sessions.clear()
            throw SIMPLError.signedOut
        }
    }
    func send(path: String, query: [URLQueryItem] = [], method: String = "GET",
                      body: Data? = nil, token: String?, authentication: Bool = false,
                      backend: Bool = false, headers: [String: String] = [:]) async throws -> Data {
        let base = backend ? configuration.apiURL : configuration.supabaseURL
        var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw SIMPLError.configurationRejected }
        var request = URLRequest(url: url)
        request.httpMethod = method; request.httpBody = body; request.timeoutInterval = 25
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if !backend { request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey") }
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        let (data, response) = try await transport.send(request)
        switch response.statusCode {
        case 200..<300: return data
        case 400 where authentication, 401 where authentication: throw SIMPLError.invalidCredentials
        case 401: throw SIMPLError.signedOut
        case 403: throw SIMPLError.forbidden
        case 409: throw SIMPLError.confirmationMissing
        default: throw SIMPLError.server
        }
    }
    private func rpc<T: Decodable & Sendable>(_ name: String, body: [String: String] = [:]) async throws -> T {
        let token = try await session().accessToken
        let data = try await send(path: "rest/v1/rpc/\(name)", method: "POST",
                                  body: JSONSerialization.data(withJSONObject: body), token: token)
        return try WireJSON.decoder().decode(T.self, from: data)
    }
    public func accessContext() async throws -> AccessContext {
        let account: AccountAccess = try await rpc("account_access_context")
        guard account.ready else { throw SIMPLError.passwordChangeRequired }
        let context: AccessContext = try await rpc("workspace_access_context")
        let identity = try await session().user.id
        guard let profile = context.profile, profile.active, profile.id == identity else { throw SIMPLError.forbidden }
        return context
    }
    func rows<T: Decodable & Sendable>(table: String, select: String, query: [URLQueryItem]) async throws -> [T] {
        var result: [T] = []
        for page in 0..<20 {
            let token = try await session().accessToken
            let data = try await send(path: "rest/v1/\(table)", query: [
                .init(name: "select", value: select), .init(name: "order", value: "id"),
                .init(name: "limit", value: "250"), .init(name: "offset", value: String(page * 250)),
            ] + query, token: token)
            let batch = try WireJSON.decoder().decode([T].self, from: data)
            result += batch
            if batch.count < 250 { return result }
        }
        throw SIMPLError.tooManyCards
    }
    public func loadSnapshot(preferences: UserPreferences) async throws -> TaskSnapshot {
        for _ in 0..<3 {
            let before = try await accessContext()
            guard let profile = before.profile else { throw SIMPLError.forbidden }
            let workspaceId = preferences.workspaceId.flatMap { selected in before.workspaces.contains(where: { $0.id == selected }) ? selected : nil } ?? profile.defaultWorkspaceId
            guard before.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.forbidden }
            let scope = [URLQueryItem(name: "workspace_id", value: "in.(\(before.workspaces.map(\.id).joined(separator: ",")))")]
            let columns: [BoardColumn] = try await rows(table: "columns", select: "id,workspace_id,name,kind,position", query: scope)
            let labels: [TaskLabel] = try await rows(table: "labels", select: "id,workspace_id,name,color", query: scope)
            let cardQuery = scope + [.init(name: "deleted_at", value: "is.null")]
            let cards: [TaskCard] = try await rows(table: "cards",
                select: "id,workspace_id,title,description,column_id,project_id,created_by,assignee_id,position,completed_at,reviewed_at,reviewed_by,created_at,updated_at,label_ids,archived_at,deleted_at,edit_revision",
                query: cardQuery)
            let fourteenDaysAgo = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-14 * 86400))
            let activities: [Activity] = try await rows(table: "notifications",
                select: "id,recipient_id,actor_id,workspace_id,card_id,event_type,subject,created_at,body",
                query: scope + [.init(name: "recipient_id", value: "eq.\(profile.id)"), .init(name: "created_at", value: "gte.\(fourteenDaysAgo)")])
            let after = try await accessContext()
            guard before.profile?.id == after.profile?.id, after.profile?.active == true,
                  before.revision != nil, after.revision != nil,
                  before.revision?.authorizationVersion == after.revision?.authorizationVersion,
                  before.revision?.boardVersion == after.revision?.boardVersion,
                  Set(before.workspaces.map(\.id)) == Set(after.workspaces.map(\.id)),
                  after.workspaces.contains(where: { $0.id == workspaceId }) else { continue }
            var snapshot = TaskSnapshot()
            snapshot.access = .ready; snapshot.profile = after.profile; snapshot.workspaces = after.workspaces
            snapshot.workspaceId = workspaceId; snapshot.revision = after.revision
            snapshot.columns = columns; snapshot.labels = labels; snapshot.cards = cards
            snapshot.activities = activities; snapshot.syncedAt = Date()
            return snapshot
        }
        throw SIMPLError.accessChanged
    }
    private static let commentSelect = "id,card_id,author_id,body,created_at,attachment_ids,author:profiles!comments_author_id_fkey(name)"
    public func comments(cardId: String, workspaceId: String) async throws -> [CardComment] {
        for _ in 0..<3 {
            let before = try await accessContext()
            guard before.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.forbidden }
            let comments: [CardComment] = try await rows(table: "comments", select: Self.commentSelect,
                query: [.init(name: "card_id", value: "eq.\(cardId)")])
            let after = try await accessContext()
            guard before.profile?.id == after.profile?.id, before.revision?.authorizationVersion == after.revision?.authorizationVersion,
                  after.workspaces.contains(where: { $0.id == workspaceId }) else { continue }
            return comments.filter { $0.cardId == cardId }.sorted { $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt }
        }
        throw SIMPLError.accessChanged
    }
    public func postComment(cardId: String, workspaceId: String, body: String, submissionId: String, attachmentIds: [String] = []) async throws -> CardComment {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (!text.isEmpty || !attachmentIds.isEmpty), attachmentIds.count <= 10, Set(attachmentIds).count == attachmentIds.count, text.utf16.count <= 5000, UUID(uuidString: submissionId) != nil else { throw SIMPLError.invalidComment }
        let before = try await accessContext()
        guard let profile = before.profile, before.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.forbidden }
        let token = try await session().accessToken
        // A stable client UUID makes retrying an uncertain response safe: a
        // duplicate insert is resolved by reading and verifying the receipt.
        let requestBody = try JSONSerialization.data(withJSONObject: ["id": submissionId, "card_id": cardId, "body": text, "attachment_ids": attachmentIds] as [String: Any])
        let existing: [CardComment] = try await rows(table:"comments", select:Self.commentSelect, query:[.init(name:"id", value:"eq.\(submissionId)")])
        if existing.isEmpty {
            do {
                _ = try await send(path: "rest/v1/comments", method: "POST", body: requestBody, token: token)
            } catch SIMPLError.confirmationMissing { /* unique UUID conflict: verify below */ }
        }
        let receipt: [CardComment] = try await rows(table: "comments", select: Self.commentSelect,
            query: [.init(name: "id", value: "eq.\(submissionId)")])
        let after = try await accessContext()
        guard before.profile?.id == after.profile?.id, before.revision?.authorizationVersion == after.revision?.authorizationVersion,
              after.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.accessChanged }
        guard let comment = receipt.first, comment.id.lowercased() == submissionId.lowercased(), comment.cardId == cardId,
              comment.authorId == profile.id, comment.body == text, Set(comment.attachmentIds ?? []) == Set(attachmentIds) else { throw SIMPLError.confirmationMissing }
        return comment
    }
    /// Uses the website's shared review fields and the signed-in caller's RLS.
    /// A revision predicate prevents acknowledging a card edited since display.
    public func review(card: TaskCard) async throws -> TaskCard {
        let before = try await accessContext()
        guard let profile = before.profile, before.workspaces.contains(where: { $0.id == card.workspaceId }), card.isActive else { throw SIMPLError.forbidden }
        if card.reviewedAt != nil { return card }
        let token = try await session().accessToken
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let body = try JSONSerialization.data(withJSONObject: ["reviewed_at": formatter.string(from: Date()), "reviewed_by": profile.id])
        let fields = "id,workspace_id,title,description,column_id,project_id,created_by,assignee_id,position,completed_at,reviewed_at,reviewed_by,created_at,updated_at,label_ids,archived_at,deleted_at,edit_revision"
        var query: [URLQueryItem] = [.init(name: "id", value: "eq.\(card.id)"), .init(name: "workspace_id", value: "eq.\(card.workspaceId)"), .init(name: "archived_at", value: "is.null"), .init(name: "deleted_at", value: "is.null"), .init(name: "reviewed_at", value: "is.null"), .init(name: "select", value: fields)]
        if let revision = card.editRevision { query.append(.init(name: "edit_revision", value: "eq.\(revision)")) }
        let data = try await send(path: "rest/v1/cards", query: query, method: "PATCH", body: body, token: token, headers: ["Prefer": "return=representation"])
        let receipts = try WireJSON.decoder().decode([TaskCard].self, from: data)
        let receipt: TaskCard
        if let returned = receipts.first {
            guard receipts.count == 1, returned.reviewedBy == profile.id else { throw SIMPLError.confirmationMissing }
            receipt = returned
        } else {
            // Another member may have read it concurrently. Accept the confirmed
            // shared state without overwriting their name or sending another write.
            let current: [TaskCard] = try await rows(table: "cards", select: fields, query: [.init(name: "id", value: "eq.\(card.id)"), .init(name: "workspace_id", value: "eq.\(card.workspaceId)")])
            guard current.count == 1, let found = current.first else { throw SIMPLError.confirmationMissing }
            receipt = found
        }
        let after = try await accessContext()
        guard before.profile?.id == after.profile?.id, before.revision?.authorizationVersion == after.revision?.authorizationVersion,
              after.workspaces.contains(where: { $0.id == card.workspaceId }) else { throw SIMPLError.accessChanged }
        guard receipt.id == card.id, receipt.workspaceId == card.workspaceId, receipt.isActive, receipt.reviewedAt != nil else { throw SIMPLError.confirmationMissing }
        return receipt
    }
    public func complete(cardId: String, completed: Bool) async throws {
        _ = try await accessContext()
        let token = try await session().accessToken
        let body = try JSONSerialization.data(withJSONObject: ["p_card": cardId, "p_completed": completed] as [String: Any])
        _ = try await send(path: "rest/v1/rpc/set_card_completed", method: "POST", body: body, token: token)
    }
    public func start(card: TaskCard, workColumn: BoardColumn) async throws -> [TaskCard] {
        _ = try await accessContext()
        guard card.workspaceId == workColumn.workspaceId, workColumn.kind == .work else { throw SIMPLError.forbidden }
        let token = try await session().accessToken
        let body = try JSONSerialization.data(withJSONObject: ["column_id": workColumn.id, "before_id": NSNull()])
        let data = try await send(path: "api/cards/\(card.id)/move", method: "POST", body: body, token: token, backend: true)
        struct Receipt: Decodable { var cards: [TaskCard] }
        let receipt = try WireJSON.decoder().decode(Receipt.self, from: data)
        guard receipt.cards.contains(where: { $0.id == card.id && $0.columnId == workColumn.id && $0.workspaceId == card.workspaceId && $0.isActive }) else {
            throw SIMPLError.confirmationMissing
        }
        return receipt.cards
    }
}
