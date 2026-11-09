import SwiftUI
import UniformTypeIdentifiers
import ImageIO
#if SWIFT_PACKAGE
import SIMPLCore
#endif

struct CommentDraftFile: Identifiable, Equatable, Sendable {
    let id: UUID
    let url: URL
    let filename: String
    let size: Int64
    var attachment: TaskAttachment?
}

extension AppModel {
    var canSendComment: Bool {
        (!commentDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !commentFiles.isEmpty)
        && commentDraft.utf16.count <= 5000 && !commentSending && !filesStaging
    }
    func chooseFiles() {
        guard !commentSending, !filesStaging else { return }
        let panel = NSOpenPanel(); panel.canChooseFiles = true; panel.canChooseDirectories = false
        panel.allowsMultipleSelection = true; panel.prompt = "Anhängen"
        guard let window = NSApp.keyWindow else { return }
        panel.beginSheetModal(for:window) { [weak self] response in
            if response == .OK { Task { @MainActor in await self?.addFiles(panel.urls) } }
        }
    }
    func addFiles(_ urls: [URL]) async {
        guard let cardId = selectedCardId, !commentSending, !filesStaging else { return }
        guard commentFiles.count + urls.count <= 10 else { commentError = SIMPLError.tooManyFiles.localizedDescription; return }
        filesStaging = true; defer { filesStaging = false }
        var staged: [CommentDraftFile] = []
        do {
            let root = await engine.attachmentDraftDirectory()
            for source in urls {
                let allowed = source.startAccessingSecurityScopedResource()
                defer { if allowed { source.stopAccessingSecurityScopedResource() } }
                let file = try await Task.detached(priority:.userInitiated) { try Self.stage(source:source, root:root) }.value
                staged.append(file)
            }
            guard selectedCardId == cardId else { for file in staged { try? FileManager.default.removeItem(at:file.url.deletingLastPathComponent()) }; return }
            commentFiles += staged; fileDrafts[cardId] = commentFiles; commentError = nil
        } catch {
            for file in staged { try? FileManager.default.removeItem(at:file.url.deletingLastPathComponent()) }
            if selectedCardId == cardId { commentError = error.localizedDescription }
        }
    }
    nonisolated private static func stage(source:URL, root:URL) throws -> CommentDraftFile {
        let info = try source.resourceValues(forKeys:[.fileSizeKey, .isRegularFileKey])
        guard info.isRegularFile == true else { throw SIMPLError.invalidFile }
        let name = source.lastPathComponent, size = Int64(info.fileSize ?? 0)
        try FilePolicy.validate(filename:name, size:size)
        let id = UUID(), directory = root.appendingPathComponent(id.uuidString)
        try FileManager.default.createDirectory(at:directory, withIntermediateDirectories:true, attributes:[.posixPermissions:0o700])
        let target = directory.appendingPathComponent(name)
        do {
            try FileManager.default.copyItem(at:source, to:target)
            guard Int64(try target.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0) == size else { throw SIMPLError.invalidFile }
            try FileManager.default.setAttributes([.posixPermissions:0o600], ofItemAtPath:target.path)
            return CommentDraftFile(id:id, url:target, filename:name, size:size)
        } catch { try? FileManager.default.removeItem(at:directory); throw error }
    }
    func addPastedImage(_ data: Data) async {
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("Bild-\(UUID().uuidString.prefix(8)).png")
        do {
            defer { try? FileManager.default.removeItem(at:temporary) }
            let png = try await Task.detached(priority:.userInitiated) {
                guard let source = CGImageSourceCreateWithData(data as CFData,nil),
                      let props = CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],
                      let width = props[kCGImagePropertyPixelWidth] as? NSNumber, let height = props[kCGImagePropertyPixelHeight] as? NSNumber,
                      width.int64Value > 0, height.int64Value > 0, width.int64Value <= 25_000_000 / height.int64Value,
                      let image = CGImageSourceCreateImageAtIndex(source,0,nil) else { throw SIMPLError.imageTooLarge }
                let output = NSMutableData()
                guard let destination = CGImageDestinationCreateWithData(output,UTType.png.identifier as CFString,1,nil) else { throw SIMPLError.storage }
                CGImageDestinationAddImage(destination,image,nil)
                guard CGImageDestinationFinalize(destination) else { throw SIMPLError.storage }
                return output as Data
            }.value
            try png.write(to:temporary); await addFiles([temporary])
        }
        catch { commentError = error.localizedDescription }
    }
    func removeFile(_ file: CommentDraftFile) {
        guard let cardId = selectedCardId, !commentSending else { return }
        commentFiles.removeAll { $0.id == file.id }; fileDrafts[cardId] = commentFiles
        try? FileManager.default.removeItem(at:file.url.deletingLastPathComponent())
        if let attachment = file.attachment {
            Task { try? await engine.discardAttachment(attachment) }
        }
    }
    func uploadCommentFiles(cardId:String) async throws -> [String] {
        let draftId = attachmentDraftIds[cardId] ?? UUID().uuidString
        attachmentDraftIds[cardId] = draftId
        var files = fileDrafts[cardId] ?? commentFiles
        for index in files.indices {
            uploadStatus = "Datei \(index + 1) von \(files.count) wird hochgeladen …"
            if files[index].attachment == nil {
                files[index].attachment = try await engine.reserveAttachment(cardId:cardId, filename:files[index].filename, size:files[index].size, draftId:draftId)
                fileDrafts[cardId] = files
                if selectedCardId == cardId { commentFiles = files }
            }
            if let reserved = files[index].attachment, reserved.status != "ready" {
                files[index].attachment = try await engine.uploadAttachment(reserved, file:files[index].url)
                fileDrafts[cardId] = files
                if selectedCardId == cardId { commentFiles = files }
            }
        }
        return files.compactMap { $0.attachment?.id }
    }
    func attachmentURL(_ item:TaskAttachment) async throws -> URL {
        do { return try await engine.downloadAttachment(item) }
        catch {
            if (error as? SIMPLError)?.clearsPrivateData == true { accept(await engine.cached()) }
            throw error
        }
    }
    func previewAttachment(_ item:TaskAttachment) async {
        do { previewURL = try await attachmentURL(item) }
        catch { fileError = error.localizedDescription }
    }
    func saveAttachment(_ item:TaskAttachment) async {
        do {
            let source = try await attachmentURL(item)
            let panel = NSSavePanel(); panel.nameFieldStringValue = item.filename; panel.prompt = "Sichern"
            guard let window = NSApp.keyWindow else { return }
            panel.beginSheetModal(for:window) { [weak self] response in
                guard response == .OK, let target = panel.url else { return }
                Task { @MainActor in
                    do {
                        let grant = target.startAccessingSecurityScopedResource(); defer { if grant { target.stopAccessingSecurityScopedResource() } }
                        try await Task.detached(priority:.userInitiated) {
                            guard FileManager.default.createFile(atPath:target.path, contents:nil) else { throw SIMPLError.storage }
                            let input = try FileHandle(forReadingFrom:source), output = try FileHandle(forWritingTo:target)
                            defer { try? input.close(); try? output.close() }
                            try output.truncate(atOffset:0)
                            while let data = try input.read(upToCount:1024 * 1024), !data.isEmpty { try output.write(contentsOf:data) }
                            try output.synchronize()
                        }.value
                    } catch { self?.fileError = error.localizedDescription }
                }
            }
        } catch { fileError = error.localizedDescription }
    }
    func copyAttachment(_ item:TaskAttachment) async {
        if item.isImage { await copyImage(item); return }
        do {
            let file = try await attachmentURL(item)
            NSPasteboard.general.clearContents()
            guard NSPasteboard.general.writeObjects([file as NSURL]) else { throw SIMPLError.storage }
        } catch { fileError = error.localizedDescription }
    }
    func copyImage(_ item:TaskAttachment) async {
        do {
            guard item.isImage else { throw SIMPLError.imageTooLarge }
            let url = try await attachmentURL(item)
            let png = try await Task.detached(priority:.userInitiated) {
                guard let source = CGImageSourceCreateWithURL(url as CFURL,nil),
                      let props = CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [CFString:Any],
                      let width = props[kCGImagePropertyPixelWidth] as? NSNumber,
                      let height = props[kCGImagePropertyPixelHeight] as? NSNumber,
                      width.int64Value > 0, height.int64Value > 0, width.int64Value <= 25_000_000 / height.int64Value,
                      let image = CGImageSourceCreateImageAtIndex(source,0,nil) else { throw SIMPLError.imageTooLarge }
                let output = NSMutableData()
                guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString,1,nil) else { throw SIMPLError.storage }
                CGImageDestinationAddImage(destination,image,nil)
                guard CGImageDestinationFinalize(destination) else { throw SIMPLError.storage }
                return output as Data
            }.value
            NSPasteboard.general.clearContents(); NSPasteboard.general.setData(png,forType:.png)
        } catch { fileError = error.localizedDescription }
    }
}
