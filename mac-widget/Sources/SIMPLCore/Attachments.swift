import Foundation

public struct TaskAttachment: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var cardId: String
    public var commentId: String?
    public var commentDraftId: String?
    public var uploadedBy: String
    public var filename: String
    public var mimeType: String
    public var sizeBytes: Int64
    public var objectPath: String
    public var status: String
    public var createdAt: Date
    public var expiresAt: Date?
    public var isImage: Bool {
        guard sizeBytes <= FilePolicy.previewLimit else { return false }
        return ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif", "image/tiff", "image/bmp", "image/avif"].contains(mimeType)
            || ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif", "tif", "tiff", "bmp", "avif", "ico", "icns"].contains((filename as NSString).pathExtension.lowercased())
    }
    public init(id: String, cardId: String, commentId: String? = nil, commentDraftId: String? = nil, uploadedBy: String, filename: String, mimeType: String, sizeBytes: Int64, objectPath: String, status: String = "ready", createdAt: Date = Date(), expiresAt: Date? = nil) {
        self.id = id; self.cardId = cardId; self.commentId = commentId; self.commentDraftId = commentDraftId
        self.uploadedBy = uploadedBy; self.filename = filename; self.mimeType = mimeType; self.sizeBytes = sizeBytes
        self.objectPath = objectPath; self.status = status; self.createdAt = createdAt; self.expiresAt = expiresAt
    }
}

public enum FilePolicy {
    public static let maximumSize: Int64 = 500 * 1024 * 1024
    public static let previewLimit: Int64 = 20 * 1024 * 1024
    public static func validate(filename: String, size: Int64) throws {
        guard !filename.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, filename.utf16.count <= 180,
              size > 0, size <= maximumSize, !filename.unicodeScalars.contains(where: {
                  $0.value < 32 || $0.value == 127 || $0 == "/" || $0 == "\\" || (0x202A...0x202E).contains($0.value) || (0x2066...0x2069).contains($0.value)
              }) else { throw SIMPLError.invalidFile }
    }
    public static func mime(filename: String, size: Int64) -> String {
        guard size <= previewLimit else { return "application/octet-stream" }
        let types = ["png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "gif":"image/gif", "pdf":"application/pdf", "docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "pptx":"application/vnd.openxmlformats-officedocument.presentationml.presentation", "txt":"text/plain", "csv":"text/csv", "md":"text/markdown", "zip":"application/zip"]
        return types[(filename as NSString).pathExtension.lowercased()] ?? "application/octet-stream"
    }
}

extension SIMPLClient {
    static let attachmentSelect = "id,card_id,comment_id,comment_draft_id,uploaded_by,filename,mime_type,size_bytes,object_path,status,created_at,expires_at"
    func attachmentAccess(workspaceId: String) async throws -> AccessContext {
        let context = try await accessContext()
        guard context.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.forbidden }
        return context
    }
    func confirmAttachmentAccess(_ before: AccessContext, workspaceId: String) async throws {
        let after = try await attachmentAccess(workspaceId: workspaceId)
        guard before.profile?.id == after.profile?.id, before.revision?.authorizationVersion == after.revision?.authorizationVersion else { throw SIMPLError.accessChanged }
    }
    public func attachments(cardId: String, workspaceId: String) async throws -> [TaskAttachment] {
        let before = try await attachmentAccess(workspaceId: workspaceId)
        let values: [TaskAttachment] = try await rows(table: "attachments", select: Self.attachmentSelect, query: [.init(name: "card_id", value: "eq.\(cardId)"), .init(name: "status", value: "eq.ready"), .init(name: "comment_draft_id", value: "is.null")])
        try await confirmAttachmentAccess(before, workspaceId: workspaceId)
        return values.filter { $0.cardId == cardId && $0.status == "ready" && $0.commentDraftId == nil }.sorted { $0.createdAt < $1.createdAt }
    }
    public func reserveAttachment(cardId: String, workspaceId: String, filename: String, size: Int64, draftId: String) async throws -> TaskAttachment {
        try FilePolicy.validate(filename: filename, size: size)
        guard UUID(uuidString: draftId) != nil else { throw SIMPLError.invalidFile }
        let before = try await attachmentAccess(workspaceId: workspaceId)
        let data = try await send(path: "api/attachments", method: "POST", body: JSONSerialization.data(withJSONObject: ["card_id":cardId, "filename":filename, "size_bytes":size, "comment_draft_id":draftId]), token: session().accessToken, backend: true)
        let item = try WireJSON.decoder().decode(TaskAttachment.self, from: data)
        try await confirmAttachmentAccess(before, workspaceId: workspaceId)
        guard item.cardId == cardId, item.uploadedBy == before.profile?.id, item.filename == filename, item.sizeBytes == size, item.commentDraftId?.lowercased() == draftId.lowercased(), item.status == "pending", UUID(uuidString: item.id) != nil else { throw SIMPLError.confirmationMissing }
        return item
    }
    public func uploadAttachment(_ item: TaskAttachment, file: URL, workspaceId: String) async throws -> TaskAttachment {
        let before = try await attachmentAccess(workspaceId: workspaceId)
        guard item.uploadedBy == before.profile?.id, item.commentDraftId != nil, item.status == "pending", !item.objectPath.contains(".."), !item.objectPath.hasPrefix("/"), !item.objectPath.contains("?") else { throw SIMPLError.forbidden }
        let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard Int64(size) == item.sizeBytes else { throw SIMPLError.invalidFile }
        var request = URLRequest(url: configuration.supabaseURL.appendingPathComponent("storage/v1/object/card-attachments/\(item.objectPath)"))
        request.httpMethod = "POST"; request.timeoutInterval = 900; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(try await session().accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue(item.mimeType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert"); request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        let (data, response) = try await transport.upload(request, file: file)
        if response.statusCode == 401 { throw SIMPLError.signedOut }
        if response.statusCode == 403 { throw SIMPLError.forbidden }
        let duplicate = response.statusCode == 409 || (response.statusCode == 400 && ["duplicate", "already exists"].contains { String(data:data,encoding:.utf8)?.lowercased().contains($0) == true })
        guard (200..<300).contains(response.statusCode) || duplicate else { throw SIMPLError.server }
        let readyData = try await send(path: "api/attachments/\(item.id)/complete", method: "POST", token: session().accessToken, backend: true)
        let ready = try WireJSON.decoder().decode(TaskAttachment.self, from: readyData)
        try await confirmAttachmentAccess(before, workspaceId: workspaceId)
        guard ready.id == item.id, ready.cardId == item.cardId, ready.filename == item.filename, ready.sizeBytes == item.sizeBytes, ready.uploadedBy == item.uploadedBy, ready.objectPath == item.objectPath, ready.commentDraftId == item.commentDraftId, ready.status == "ready" else { throw SIMPLError.confirmationMissing }
        return ready
    }
    public func discardAttachment(_ item: TaskAttachment, workspaceId: String) async throws {
        _ = try await attachmentAccess(workspaceId: workspaceId)
        guard item.commentDraftId != nil, item.uploadedBy == (try await session().user.id) else { throw SIMPLError.forbidden }
        _ = try await send(path: "api/attachments/\(item.id)", query: [.init(name:"draft", value:"1")], method:"DELETE", token: session().accessToken, backend:true)
    }
    public func downloadAttachment(_ item: TaskAttachment, workspaceId: String) async throws -> URL {
        try FilePolicy.validate(filename: item.filename, size: item.sizeBytes)
        guard item.status == "ready", UUID(uuidString: item.id) != nil else { throw SIMPLError.invalidFile }
        let before = try await attachmentAccess(workspaceId: workspaceId)
        var request = URLRequest(url: configuration.apiURL.appendingPathComponent("api/attachments/\(item.id)/download"))
        request.timeoutInterval = 900; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(try await session().accessToken)", forHTTPHeaderField:"Authorization")
        request.setValue("no-store", forHTTPHeaderField:"Cache-Control")
        let (file, response) = try await transport.download(request)
        do {
            if response.statusCode == 401 { throw SIMPLError.signedOut }
            if response.statusCode == 403 { throw SIMPLError.forbidden }
            guard response.statusCode == 200, Int64(try file.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0) == item.sizeBytes else { throw SIMPLError.confirmationMissing }
            try await confirmAttachmentAccess(before, workspaceId: workspaceId)
            return file
        } catch { try? FileManager.default.removeItem(at:file); throw error }
    }
}
