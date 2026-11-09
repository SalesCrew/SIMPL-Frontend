import Foundation
import UniformTypeIdentifiers

public enum FeedbackCopyError: Error, Equatable, LocalizedError {
    case changed, clipboard
    public var errorDescription: String? {
        switch self {
        case .changed: "Die Karte oder ihre Anhänge wurden während des Kopierens geändert. Bitte kopiere sie erneut."
        case .clipboard: "Die Zwischenablage konnte nicht aktualisiert werden. Bitte versuche es erneut."
        }
    }
}

public struct TaskChecklist: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var items: [Item]
    public struct Item: Codable, Equatable, Sendable {
        public var id: String
        public var name: String
        public var completed: Bool
        public init(id: String, name: String, completed: Bool) {
            self.id = id; self.name = name; self.completed = completed
        }
    }
    public init(id: String, name: String, items: [Item]) {
        self.id = id; self.name = name; self.items = items
    }
}

/// A fresh, read-only export. Kept separate from the board snapshot so copying
/// a task doesn't change the widget, filters, read status or comment draft.
public struct TaskFeedback: Codable, Equatable, Sendable {
    public var id: String
    public var workspaceId: String
    public var title: String
    public var description: String?
    public var checklists: [TaskChecklist]
    public init(id: String, workspaceId: String, title: String, description: String?, checklists: [TaskChecklist] = []) {
        self.id = id; self.workspaceId = workspaceId; self.title = title
        self.description = description; self.checklists = checklists
    }
    public var text: String {
        var result = "Feedback i got:\n\nName:\n\(title)\n\nDescription:\n\(description ?? "")"
        if !checklists.isEmpty {
            result += "\n\nChecklist:\n" + checklists.map { list in
                ([list.name] + list.items.map { "- [\($0.completed ? "x" : " ")] \($0.name)" }).joined(separator: "\n")
            }.joined(separator: "\n\n")
        }
        return result
    }
}

public struct TaskFeedbackSource: Equatable, Sendable {
    public let task: TaskFeedback
    public let attachments: [TaskAttachment]
    public let comments: [CardComment]
    public let accountId: String
    public let authorizationVersion: Int
    public init(task: TaskFeedback, attachments: [TaskAttachment], comments: [CardComment] = [], accountId: String, authorizationVersion: Int) {
        self.task = task; self.attachments = attachments; self.comments = comments
        self.accountId = accountId; self.authorizationVersion = authorizationVersion
    }
    public func files(for comment: CardComment) -> [TaskAttachment] {
        attachments.filter { $0.commentId == comment.id || (comment.attachmentIds ?? []).contains($0.id) }
    }
    public var orderedAttachments: [TaskAttachment] {
        let linked = Set(comments.flatMap { files(for: $0).map(\.id) })
        let candidates = attachments.filter { $0.commentId == nil && !linked.contains($0.id) }
            + comments.flatMap { files(for: $0) } + attachments
        var seen = Set<String>()
        return candidates.filter { seen.insert($0.id).inserted }
    }
    public func text(timeZone: TimeZone = .autoupdatingCurrent) -> String {
        var result = task.text
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_AT"); formatter.timeZone = timeZone
        formatter.dateFormat = "dd.MM.yyyy HH:mm"
        let positions = Dictionary(uniqueKeysWithValues: orderedAttachments.enumerated().map { ($1.id, $0 + 1) })
        if !comments.isEmpty { result += "\n\nKommentare:\n" + comments.map { comment in
            let references = files(for: comment).sorted { (positions[$0.id] ?? 0) < (positions[$1.id] ?? 0) }.compactMap { file in
                positions[file.id].map { "attachment \($0): \(file.feedbackType)" }
            }
            let suffix = references.isEmpty ? "" : " (\(references.joined(separator: ", ")))"
            return "kommentar \(comment.authorName) \(formatter.string(from: comment.createdAt)): \(comment.body)\(suffix)"
        }.joined(separator: "\n\n") }
        if !orderedAttachments.isEmpty {
            result += "\n\nAttachments:\n" + orderedAttachments.enumerated().map { index, file in
                "attachment \(index + 1): \(file.feedbackType) — \(file.filename)"
            }.joined(separator: "\n")
        }
        return result
    }
}

extension TaskAttachment {
    public var feedbackType: String {
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "xlsx", "xls", "xlsm", "xlsb": return "Excel"
        case "csv", "tsv": return "\(ext.uppercased()) spreadsheet"
        case "doc", "docx": return "Word"
        case "ppt", "pptx": return "PowerPoint"
        case "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "avif", "svg", "ico", "icns": return "\(ext.uppercased()) image"
        case "pdf": return "PDF"
        case "zip", "rar", "7z", "gz", "tar": return "\(ext.uppercased()) archive"
        case "md", "markdown": return "Markdown"
        default: return UTType(filenameExtension: ext)?.localizedDescription ?? (ext.isEmpty ? "File" : "\(ext.uppercased()) file")
        }
    }
    public var isFeedbackImage: Bool {
        mimeType.lowercased().hasPrefix("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "avif", "ico", "icns", "svg"].contains((filename as NSString).pathExtension.lowercased())
    }
}

extension SIMPLClient {
    public func feedback(cardId: String, workspaceId: String) async throws -> TaskFeedbackSource {
        let before = try await accessContext()
        guard let accountId = before.profile?.id, let revision = before.revision,
              before.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.forbidden }
        let tasks: [TaskFeedback] = try await rows(table: "cards",
            select: "id,workspace_id,title,description,checklists",
            query: [.init(name: "id", value: "eq.\(cardId)"), .init(name: "workspace_id", value: "eq.\(workspaceId)"), .init(name: "deleted_at", value: "is.null")])
        guard tasks.count == 1, let task = tasks.first, task.id == cardId, task.workspaceId == workspaceId else { throw SIMPLError.missingCard }
        let messages = try await comments(cardId: cardId, workspaceId: workspaceId)
        let files = try await attachments(cardId: cardId, workspaceId: workspaceId)
        let after = try await accessContext()
        guard after.profile?.id == accountId, after.revision?.authorizationVersion == revision.authorizationVersion,
              after.workspaces.contains(where: { $0.id == workspaceId }) else { throw SIMPLError.accessChanged }
        guard after.revision?.boardVersion == revision.boardVersion else { throw FeedbackCopyError.changed }
        return TaskFeedbackSource(task: task, attachments: files, comments: messages, accountId: accountId, authorizationVersion: revision.authorizationVersion)
    }
}
