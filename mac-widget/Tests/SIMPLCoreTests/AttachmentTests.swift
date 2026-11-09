import Foundation
import Testing
@testable import SIMPLCore

private let fixtureCard = "A1111111-1111-1111-1111-111111111111"
private actor AttachmentAPI: HTTPTransport {
    enum Mode { case normal, uncertainUpload, uncertainComment, revokedDownload, wrongReceipt, forbidden }
    var mode: Mode = .normal
    var requests: [URLRequest] = []
    var item: TaskAttachment?
    var object: Data?
    var comments: [CardComment] = []
    var objectWrites = 0
    var commentWrites = 0
    var version = 1
    var downloaded: URL?
    func setMode(_ value:Mode) { mode = value }
    func send(_ request:URLRequest) async throws -> (Data,HTTPURLResponse) {
        requests.append(request)
        let path = request.url!.path
        let encoder = JSONEncoder(); encoder.keyEncodingStrategy = .convertToSnakeCase; encoder.dateEncodingStrategy = .iso8601
        var status = 200, data = Data("null".utf8)
        if mode == .forbidden { status = 403 }
        else if path.hasSuffix("account_access_context") { data = Data(#"{"ready":true}"#.utf8) }
        else if path.hasSuffix("workspace_access_context") {
            let snapshot = PreviewData.snapshot()
            data = try encoder.encode(AccessContext(profile:snapshot.profile,workspaces:snapshot.workspaces,revision:AccessRevision(id:"preview-user",authorizationVersion:version,boardVersion:1)))
        } else if path == "/api/attachments" {
            let body = try JSONSerialization.jsonObject(with:request.httpBody!) as! [String:Any]
            let value = TaskAttachment(id:UUID().uuidString,cardId:body["card_id"] as! String,commentDraftId:body["comment_draft_id"] as? String,uploadedBy:"preview-user",filename:body["filename"] as! String,mimeType:"application/octet-stream",sizeBytes:(body["size_bytes"] as! NSNumber).int64Value,objectPath:"preview-workspace/attachment/original",status:"pending")
            item = value; data = try encoder.encode(value)
        } else if path.hasPrefix("/storage/v1/object/") {
            if object != nil { status = 400; data = Data(#"{"error":"Duplicate","message":"The resource already exists"}"#.utf8) }
            else { object = request.httpBody; objectWrites += 1; if mode == .uncertainUpload { throw SIMPLError.network } }
        } else if path.hasSuffix("/complete") {
            var receipt = item!; receipt.status = "ready"; item = receipt
            if mode == .wrongReceipt { receipt.filename = "wrong.bin" }
            data = try encoder.encode(receipt)
        } else if path == "/rest/v1/attachments" {
            data = try encoder.encode(item.map { $0.commentDraftId == nil && $0.status == "ready" ? [$0] : [] } ?? [])
        } else if path == "/rest/v1/comments" {
            if request.httpMethod == "POST" {
                let body = try JSONSerialization.jsonObject(with:request.httpBody!) as! [String:Any]
                let comment = CardComment(id:body["id"] as! String,cardId:body["card_id"] as! String,authorId:"preview-user",body:body["body"] as! String,attachmentIds:body["attachment_ids"] as? [String])
                comments.append(comment); commentWrites += 1; item?.commentId = comment.id; item?.commentDraftId = nil
                if mode == .uncertainComment { throw SIMPLError.network }
            } else { data = try encoder.encode(comments) }
        } else if path.hasSuffix("/download") { data = object! }
        return (data,HTTPURLResponse(url:request.url!,statusCode:status,httpVersion:nil,headerFields:nil)!)
    }
    func download(_ request:URLRequest) async throws -> (URL,HTTPURLResponse) {
        let (data,response) = try await send(request)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try data.write(to:file); downloaded = file
        if mode == .revokedDownload { version += 1 }
        return (file,response)
    }
}
private func attachmentClient(_ api:AttachmentAPI) throws -> SIMPLClient {
    let config = try ServiceConfiguration(supabaseURL:URL(string:"https://xqvexzoswhraqicbmckj.supabase.co")!,publishableKey:"sb_publishable_fixture",apiURL:URL(string:"https://fixture.example")!,appURL:URL(string:"https://fixture.example")!)
    return SIMPLClient(configuration:config,transport:api,sessions:MemorySessionStore(AuthSession(accessToken:"fixture-token",refreshToken:"fixture-refresh",expiresAt:Date().timeIntervalSince1970 + 3600,user:AuthUser(id:"preview-user",email:nil))))
}
struct AttachmentTests {
    @Test func nativeRasterFormatsAndOversizedFilesHaveAppropriatePresentation() {
        func item(_ filename:String, size:Int64 = 100) -> TaskAttachment { TaskAttachment(id:UUID().uuidString,cardId:fixtureCard,uploadedBy:"u",filename:filename,mimeType:"application/octet-stream",sizeBytes:size,objectPath:"unused") }
        for name in ["photo.HEIC", "scan.tiff", "photo.avif", "picture.bmp", "image.png"] { #expect(item(name).isImage) }
        #expect(!item("image.png",size:FilePolicy.previewLimit + 1).isImage)
        #expect(!item("video.mov").isImage)
        #expect(!item("archive.zip").isImage)
    }

    @Test func allFormatsUseTheWebsiteLimitsAndSafeNames() throws {
        for name in ["design.psd", "video.mov", "archive.tar.gz", "script.sh", "résumé.pdf", "photo.heic"] { try FilePolicy.validate(filename:name,size:FilePolicy.maximumSize) }
        #expect(FilePolicy.mime(filename:"design.psd",size:30) == "application/octet-stream")
        #expect(FilePolicy.mime(filename:"PHOTO.PNG",size:30) == "image/png")
        #expect(FilePolicy.mime(filename:"PHOTO.PNG",size:FilePolicy.previewLimit + 1) == "application/octet-stream")
        for name in ["", "../file", "folder\\file", "bad\nfile", "bad\u{202e}.pdf", String(repeating:"a",count:181)] { #expect(throws:SIMPLError.invalidFile) { try FilePolicy.validate(filename:name,size:2) } }
        for size:Int64 in [0,-1,FilePolicy.maximumSize + 1] { #expect(throws:SIMPLError.invalidFile) { try FilePolicy.validate(filename:"okay.bin",size:size) } }
    }
    @Test func fileOnlyCommentUploadsAndDownloadsThroughCallerPermissions() async throws {
        let api = AttachmentAPI(), client = try attachmentClient(api)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try Data("unknown file format".utf8).write(to:file); defer { try? FileManager.default.removeItem(at:file) }
        let pending = try await client.reserveAttachment(cardId:fixtureCard,workspaceId:"preview-workspace",filename:"design.psd",size:19,draftId:UUID().uuidString)
        let ready = try await client.uploadAttachment(pending,file:file,workspaceId:"preview-workspace")
        let comment = try await client.postComment(cardId:fixtureCard,workspaceId:"preview-workspace",body:"",submissionId:UUID().uuidString,attachmentIds:[ready.id])
        #expect(comment.body.isEmpty); #expect(comment.attachmentIds == [ready.id])
        let visible = try await client.attachments(cardId:fixtureCard,workspaceId:"preview-workspace")
        let published = try #require(visible.first)
        let download = try await client.downloadAttachment(published,workspaceId:"preview-workspace")
        defer { try? FileManager.default.removeItem(at:download) }
        #expect(try Data(contentsOf:download) == Data(contentsOf:file))
        let requests = await api.requests
        #expect(requests.allSatisfy { $0.value(forHTTPHeaderField:"Authorization") == "Bearer fixture-token" })
        let upload = try #require(requests.first { $0.url!.path.hasPrefix("/storage/") })
        #expect(upload.value(forHTTPHeaderField:"x-upsert") == "false")
        #expect(requests.contains { $0.url!.path.hasSuffix("/download") && $0.url!.host == "fixture.example" })
    }
    @Test func uncertainUploadAndAttachmentCommentRetryDoNotDuplicateAnything() async throws {
        let api = AttachmentAPI(), client = try attachmentClient(api)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try Data("abc".utf8).write(to:file); defer { try? FileManager.default.removeItem(at:file) }
        let pending = try await client.reserveAttachment(cardId:fixtureCard,workspaceId:"preview-workspace",filename:"sample.bin",size:3,draftId:UUID().uuidString)
        await api.setMode(.uncertainUpload)
        await #expect(throws:SIMPLError.network) { try await client.uploadAttachment(pending,file:file,workspaceId:"preview-workspace") }
        await api.setMode(.normal)
        let ready = try await client.uploadAttachment(pending,file:file,workspaceId:"preview-workspace")
        #expect(await api.objectWrites == 1)
        let id = UUID().uuidString
        await api.setMode(.uncertainComment)
        await #expect(throws:SIMPLError.network) { try await client.postComment(cardId:fixtureCard,workspaceId:"preview-workspace",body:"",submissionId:id,attachmentIds:[ready.id]) }
        await api.setMode(.normal)
        let receipt = try await client.postComment(cardId:fixtureCard,workspaceId:"preview-workspace",body:"",submissionId:id,attachmentIds:[ready.id])
        #expect(receipt.id == id); #expect(await api.commentWrites == 1)
    }
    @Test func unauthorizedTransfersAndWrongReceiptsFailClosed() async throws {
        let api = AttachmentAPI(), client = try attachmentClient(api)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try Data("abc".utf8).write(to:file); defer { try? FileManager.default.removeItem(at:file) }
        await #expect(throws:SIMPLError.invalidFile) { try await client.reserveAttachment(cardId:fixtureCard,workspaceId:"preview-workspace",filename:"../bad",size:3,draftId:UUID().uuidString) }
        #expect(await api.requests.isEmpty)
        let pending = try await client.reserveAttachment(cardId:fixtureCard,workspaceId:"preview-workspace",filename:"sample.bin",size:3,draftId:UUID().uuidString)
        await api.setMode(.wrongReceipt)
        await #expect(throws:SIMPLError.confirmationMissing) { try await client.uploadAttachment(pending,file:file,workspaceId:"preview-workspace") }
        await api.setMode(.normal)
        let ready = try await client.uploadAttachment(pending,file:file,workspaceId:"preview-workspace")
        _ = try await client.postComment(cardId:fixtureCard,workspaceId:"preview-workspace",body:"",submissionId:UUID().uuidString,attachmentIds:[ready.id])
        let published = try #require(try await client.attachments(cardId:fixtureCard,workspaceId:"preview-workspace").first)
        await api.setMode(.revokedDownload)
        await #expect(throws:SIMPLError.accessChanged) { try await client.downloadAttachment(published,workspaceId:"preview-workspace") }
        let downloaded = try #require(await api.downloaded)
        #expect(!FileManager.default.fileExists(atPath:downloaded.path))
    }
    @Test func localAttachmentBytesAreClearedWithThePrivateSession() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:directory) }
        let store = SharedStore(directory:directory)
        for name in ["AttachmentCache","AttachmentDrafts"] { let folder = directory.appendingPathComponent(name); try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true); try Data("private".utf8).write(to:folder.appendingPathComponent("file")) }
        _ = try store.removePrivateData()
        #expect(!FileManager.default.fileExists(atPath:directory.appendingPathComponent("AttachmentCache").path))
        #expect(!FileManager.default.fileExists(atPath:directory.appendingPathComponent("AttachmentDrafts").path))
    }
}
