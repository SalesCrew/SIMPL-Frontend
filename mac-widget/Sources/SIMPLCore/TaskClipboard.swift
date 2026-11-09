import AppKit

@MainActor
public enum TaskClipboard {
    public static let codexPrompt = "read the feedback i got md"
    public static func write(text: String, files: [URL], to board: NSPasteboard = .general) throws {
        // Original file URLs keep every format intact, including animated images,
        // archives and large files. macOS supplies sandbox access to the receiver.
        // Plain text remains available to text editors; the companion Markdown
        // document supplied by the engine retains it in Codex's file-first paste.
        for url in files {
            guard url.isFileURL, try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else { throw SIMPLError.invalidFile }
        }
        let prompt = NSPasteboardItem()
        guard prompt.setString(text, forType: .string) else { throw FeedbackCopyError.clipboard }
        let escaped = text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        prompt.setString("<pre>\(escaped)</pre>", forType: .html)
        let objects: [any NSPasteboardWriting] = [prompt] + files.map { $0 as NSURL }
        board.clearContents()
        guard board.writeObjects(objects) else { throw FeedbackCopyError.clipboard }
    }
}
