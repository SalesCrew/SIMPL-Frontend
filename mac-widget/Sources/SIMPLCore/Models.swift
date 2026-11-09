import Foundation

public enum ColumnKind: String, Codable, Sendable { case project, work, done }
public enum TaskSection: String, Codable, CaseIterable, Sendable {
    case all, new, work, done
    public var title: String {
        switch self { case .all: "Alle Karten"; case .new: "Neu"; case .work: "In Arbeit"; case .done: "Fertig" }
    }
    public var symbol: String {
        switch self { case .all: "rectangle.stack"; case .new: "tray"; case .work: "clock"; case .done: "checkmark.circle" }
    }
}
public enum AccessState: String, Codable, Sendable {
    case signedOut, ready, passwordChangeRequired, unavailable
}

public struct Profile: Codable, Equatable, Sendable {
    public var id: String
    public var name: String
    public var email: String
    public var role: String
    public var defaultWorkspaceId: String
    public var active: Bool
}
public struct Workspace: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var color: String
    public init(id: String, name: String, color: String = "green") {
        self.id = id; self.name = name; self.color = color
    }
}
public struct BoardColumn: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var workspaceId: String
    public var name: String
    public var kind: ColumnKind
    public var position: Double
    public init(id: String, workspaceId: String, name: String, kind: ColumnKind, position: Double = 0) {
        self.id = id; self.workspaceId = workspaceId; self.name = name; self.kind = kind; self.position = position
    }
}
public struct TaskLabel: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var workspaceId: String
    public var name: String
    public var color: String
    public init(id: String, workspaceId: String, name: String, color: String = "green") {
        self.id = id; self.workspaceId = workspaceId; self.name = name; self.color = color
    }
}
public struct TaskCard: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var workspaceId: String
    public var title: String
    public var description: String?
    public var columnId: String
    public var projectId: String?
    public var createdBy: String
    public var assigneeId: String?
    public var position: Double
    public var reviewedAt: Date?
    public var reviewedBy: String?
    public var completedAt: Date?
    public var createdAt: Date
    public var updatedAt: Date
    public var labelIds: [String]
    public var archivedAt: Date?
    public var deletedAt: Date?
    public var editRevision: Int?
    public init(id: String, workspaceId: String, title: String, columnId: String,
                projectId: String? = nil, createdBy: String, assigneeId: String? = nil,
                position: Double = 0, completedAt: Date? = nil, createdAt: Date = Date(),
                updatedAt: Date = Date(), labelIds: [String] = [], archivedAt: Date? = nil,
                deletedAt: Date? = nil, editRevision: Int? = nil, description: String? = nil, reviewedAt: Date? = nil, reviewedBy: String? = nil) {
        self.id = id; self.workspaceId = workspaceId; self.title = title; self.columnId = columnId
        self.projectId = projectId; self.createdBy = createdBy; self.assigneeId = assigneeId
        self.position = position; self.completedAt = completedAt; self.createdAt = createdAt
        self.updatedAt = updatedAt; self.labelIds = labelIds; self.archivedAt = archivedAt
        self.deletedAt = deletedAt; self.editRevision = editRevision; self.description = description
        self.reviewedAt = reviewedAt; self.reviewedBy = reviewedBy
    }
    public var isActive: Bool { archivedAt == nil && deletedAt == nil }
}
public struct Activity: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var recipientId: String
    public var actorId: String
    public var workspaceId: String
    public var cardId: String?
    public var eventType: String
    public var subject: String
    public var createdAt: Date
    public var body: String? = nil
}

public struct CardComment: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var cardId: String
    public var authorId: String
    public var body: String
    public var createdAt: Date
    public var attachmentIds: [String]? = nil
    public var author: Author?
    public struct Author: Codable, Equatable, Sendable { public var name: String }
    public init(id: String, cardId: String, authorId: String, body: String, createdAt: Date = Date(), authorName: String? = nil, attachmentIds: [String]? = nil) {
        self.id = id; self.cardId = cardId; self.authorId = authorId; self.body = body; self.createdAt = createdAt
        self.attachmentIds = attachmentIds
        self.author = authorName.map { Author(name: $0) }
    }
    public var authorName: String { author?.name ?? "Mitglied" }
}
public struct AccessRevision: Codable, Equatable, Sendable {
    public var id: String
    public var authorizationVersion: Int
    public var boardVersion: Int
}
public struct AccessContext: Codable, Equatable, Sendable {
    public var profile: Profile?
    public var workspaces: [Workspace]
    public var revision: AccessRevision?
}
public struct AccountAccess: Decodable, Sendable { public var ready: Bool }
public struct AuthUser: Codable, Equatable, Sendable { public var id: String; public var email: String? }
public struct AuthSession: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var expiresAt: Double
    public var user: AuthUser
    public var requiresRefresh: Bool { expiresAt < Date().timeIntervalSince1970 + 90 }
    public init(accessToken: String, refreshToken: String, expiresAt: Double, user: AuthUser) {
        self.accessToken = accessToken; self.refreshToken = refreshToken
        self.expiresAt = expiresAt; self.user = user
    }
}

public struct UserPreferences: Codable, Equatable, Sendable {
    public var workspaceId: String? = nil
    public var projectId: String? = nil
    public var widgetSection = TaskSection.all
    public var widgetPage = 0
    public var knownApprovedCardIds: Set<String> = []
    public var notificationWorkspaceIds: Set<String> = []
    public var approvalBaselineEstablished = false
    public var notifyOnApprovals = true
    public var notifyOnArchives = true
    public var onlyMyCards = false
    public var filterLabelIds: Set<String> = []
    public var watchedLabelIds: Set<String> = []
    public var notificationsEnabled = false
    public var notifyOnComments = true
    public var lastViewedAt: Date? = nil
    public var seenCardUpdates: [String: Date] = [:]
    public var newMode = NewMode.sinceLastCheck
    public var deliveredActivityIds: Set<String> = []
    public var notificationBaselineEstablished = false
    public var hideWidgetTitles = false
    public var textScale = TextScale.standard
    public init() {}
    public enum NewMode: String, Codable, Sendable { case projectCards, sinceLastCheck }
    public enum TextScale: String, Codable, CaseIterable, Sendable {
        case standard, large, extraLarge
        public var title: String { switch self { case .standard: "Standard"; case .large: "Groß"; case .extraLarge: "Sehr groß" } }
        public var multiplier: Double { switch self { case .standard: 1; case .large: 1.2; case .extraLarge: 1.4 } }
    }
    private enum CodingKeys: String, CodingKey {
        case notificationWorkspaceIds, approvalBaselineEstablished, projectId, widgetSection, widgetPage, knownApprovedCardIds, notifyOnApprovals, notifyOnArchives
        case workspaceId, onlyMyCards, filterLabelIds, watchedLabelIds, notificationsEnabled, notifyOnComments
        case lastViewedAt, seenCardUpdates, newMode, deliveredActivityIds, notificationBaselineEstablished, hideWidgetTitles, textScale
    }
    public init(from decoder: Decoder) throws {
        self.init()
        let c = try decoder.container(keyedBy: CodingKeys.self)
        workspaceId = try c.decodeIfPresent(String.self, forKey: .workspaceId)
        projectId = try c.decodeIfPresent(String.self, forKey: .projectId)
        widgetSection = try c.decodeIfPresent(TaskSection.self, forKey: .widgetSection) ?? .all
        widgetPage = max(0, try c.decodeIfPresent(Int.self, forKey: .widgetPage) ?? 0)
        knownApprovedCardIds = try c.decodeIfPresent(Set<String>.self, forKey: .knownApprovedCardIds) ?? []
        approvalBaselineEstablished = try c.decodeIfPresent(Bool.self, forKey: .approvalBaselineEstablished) ?? false
        notificationWorkspaceIds = try c.decodeIfPresent(Set<String>.self, forKey: .notificationWorkspaceIds) ?? []
        notifyOnApprovals = try c.decodeIfPresent(Bool.self, forKey: .notifyOnApprovals) ?? true
        notifyOnArchives = try c.decodeIfPresent(Bool.self, forKey: .notifyOnArchives) ?? true
        onlyMyCards = try c.decodeIfPresent(Bool.self, forKey: .onlyMyCards) ?? false
        filterLabelIds = try c.decodeIfPresent(Set<String>.self, forKey: .filterLabelIds) ?? []
        watchedLabelIds = try c.decodeIfPresent(Set<String>.self, forKey: .watchedLabelIds) ?? []
        notificationsEnabled = try c.decodeIfPresent(Bool.self, forKey: .notificationsEnabled) ?? false
        notifyOnComments = try c.decodeIfPresent(Bool.self, forKey: .notifyOnComments) ?? true
        lastViewedAt = try c.decodeIfPresent(Date.self, forKey: .lastViewedAt)
        seenCardUpdates = try c.decodeIfPresent([String: Date].self, forKey: .seenCardUpdates) ?? [:]
        newMode = try c.decodeIfPresent(NewMode.self, forKey: .newMode) ?? .sinceLastCheck
        deliveredActivityIds = try c.decodeIfPresent(Set<String>.self, forKey: .deliveredActivityIds) ?? []
        notificationBaselineEstablished = try c.decodeIfPresent(Bool.self, forKey: .notificationBaselineEstablished) ?? false
        hideWidgetTitles = try c.decodeIfPresent(Bool.self, forKey: .hideWidgetTitles) ?? false
        textScale = try c.decodeIfPresent(TextScale.self, forKey: .textScale) ?? .standard
    }
}

public struct TaskSnapshot: Codable, Equatable, Sendable {
    public var access: AccessState = .signedOut
    public var profile: Profile? = nil
    public var workspaces: [Workspace] = []
    public var workspaceId: String? = nil
    public var revision: AccessRevision? = nil
    public var columns: [BoardColumn] = []
    public var cards: [TaskCard] = []
    public var labels: [TaskLabel] = []
    public var activities: [Activity] = []
    public var syncedAt: Date? = nil
    public var errorMessage: String? = nil
    public var isPreview = false
    public init() {}
    public var workspaceName: String {
        workspaces.first(where: { $0.id == workspaceId })?.name ?? "SIMPL"
    }
    public func section(of card: TaskCard) -> TaskSection {
        if card.completedAt != nil || columns.first(where: { $0.id == card.columnId })?.kind == .done { return .done }
        return columns.first(where: { $0.id == card.columnId })?.kind == .work ? .work : .new
    }
    public func visibleCards(_ section: TaskSection, preferences: UserPreferences) -> [TaskCard] {
        guard access == .ready, let profile else { return [] }
        let accessibleIds = Set(workspaces.map(\.id))
        let activityDates = section == .new ? Dictionary(activities.filter { accessibleIds.contains($0.workspaceId) }.compactMap { activity in
            activity.cardId.map { ($0, activity.createdAt) }
        }, uniquingKeysWith: max) : [:]
        func changed(_ card: TaskCard) -> Date { max(card.updatedAt, activityDates[card.id] ?? .distantPast) }
        return cards.filter { card in
            guard card.isActive, accessibleIds.contains(card.workspaceId) else { return false }
            guard !preferences.onlyMyCards || card.assigneeId == profile.id || card.createdBy == profile.id else { return false }
            if section == .new {
                return card.reviewedAt == nil
            }
            guard card.workspaceId == workspaceId else { return false }
            if section != .all { guard self.section(of: card) == section else { return false } }
            if let selection = preferences.projectId {
                if selection.hasPrefix("label:") {
                    guard let label = projectLabel(for: selection), card.labelIds.contains(label.id) else { return false }
                } else {
                    guard card.projectId == selection || (card.projectId == nil && card.columnId == selection) else { return false }
                }
            }
            guard preferences.filterLabelIds.isEmpty || !preferences.filterLabelIds.isDisjoint(with: card.labelIds) else { return false }
            return true
        }.sorted {
            if section == .done { return ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
            if section == .new { let a = changed($0), b = changed($1); return a == b ? $0.id < $1.id : a > b }
            return $0.position == $1.position ? $0.id < $1.id : $0.position < $1.position
        }
    }
    public var projects: [BoardColumn] {
        var options = columns.filter { $0.workspaceId == workspaceId && $0.kind == .project }.sorted { $0.position == $1.position ? $0.id < $1.id : $0.position < $1.position }
        if let label = inkognitoProjectLabel {
            options.append(BoardColumn(id: "label:" + label.id, workspaceId: label.workspaceId, name: label.name,
                                       kind: .project, position: (options.last?.position ?? 0) + 1))
        }
        return options
    }
    private var inkognitoProjectLabel: TaskLabel? {
        labels.first { $0.workspaceId == workspaceId && $0.id == "91984a63-b73b-49f5-b34b-ca4ed773834c" }
    }
    public func projectLabel(for selection: String?) -> TaskLabel? {
        guard let label = inkognitoProjectLabel, selection == "label:" + label.id else { return nil }
        return label
    }
    public func lastChange(of card: TaskCard) -> Date {
        activities.reduce(card.updatedAt) { date, activity in
            activity.cardId == card.id && activity.workspaceId == card.workspaceId ? max(date, activity.createdAt) : date
        }
    }
    public func isUnread(_ card: TaskCard, preferences: UserPreferences) -> Bool {
        card.isActive && card.reviewedAt == nil
    }
    public func workspaceName(for card: TaskCard) -> String {
        workspaces.first { $0.id == card.workspaceId }?.name ?? "Workspace"
    }
    public func widgetCards(preferences: UserPreferences, pageSize: Int) -> (cards: [TaskCard], page: Int, pages: Int) {
        let cards = visibleCards(preferences.widgetSection, preferences: preferences)
        let pages = max(1, (cards.count + pageSize - 1) / pageSize)
        let page = min(max(0, preferences.widgetPage), pages - 1)
        return (Array(cards.dropFirst(page * pageSize).prefix(pageSize)), page, pages)
    }
    public func labels(for card: TaskCard) -> [TaskLabel] {
        labels.filter { $0.workspaceId == card.workspaceId && card.labelIds.contains($0.id) }
    }
    public func projectName(for card: TaskCard) -> String? {
        columns.first(where: { $0.id == (card.projectId ?? card.columnId) && $0.kind == .project })?.name
    }
}

public enum SIMPLError: Error, Equatable, Sendable, LocalizedError {
    case notConfigured, signedOut, invalidCredentials, forbidden, passwordChangeRequired
    case invalidComment, network, server, configurationRejected, accessChanged, missingCard, confirmationMissing, tooManyCards
    case keychain(Int32), storage, invalidFile, tooManyFiles, imageTooLarge
    public var errorDescription: String? {
        switch self {
        case .invalidComment: "Bitte füge Text oder eine Datei hinzu. Maximal 5.000 Zeichen."
        case .invalidFile: "Datei ungültig: 1 Byte bis 500 MB, Dateiname maximal 180 Zeichen."
        case .tooManyFiles: "Maximal 10 Dateien pro Kommentar."
        case .imageTooLarge: "Dieses Bild ist zu groß zum Kopieren. Bitte lade die Originaldatei herunter."
        case .notConfigured: "SIMPL ist noch nicht eingerichtet."
        case .signedOut: "Bitte melde dich erneut an."
        case .invalidCredentials: "E-Mail oder Passwort stimmen nicht."
        case .forbidden, .accessChanged: "Dein Zugriff hat sich geändert. Bitte erneut laden."
        case .passwordChangeRequired: "Bitte ändere zuerst dein Startpasswort in SIMPL."
        case .network: "Gerade offline. Deine letzte Ansicht bleibt erhalten."
        case .missingCard: "Diese Aufgabe ist nicht mehr verfügbar."
        case .confirmationMissing: "Die Änderung konnte nicht bestätigt werden. Bitte erneut laden."
        case .configurationRejected: "Die Verbindungseinstellungen sind nicht für dieses SIMPL-Projekt geeignet."
        case .tooManyCards: "Zu viele Aufgaben für diese Ansicht. Bitte den Workspace eingrenzen."
        case .keychain: "Die sichere Anmeldung ist nicht verfügbar. Bitte die App-Signierung prüfen."
        case .storage: "Die lokale Ansicht konnte nicht gespeichert werden."
        case .server: "SIMPL ist gerade nicht erreichbar. Bitte erneut versuchen."
        }
    }
    public var clearsPrivateData: Bool {
        self == .signedOut || self == .forbidden || self == .accessChanged || self == .passwordChangeRequired
    }
}

public enum WireJSON {
    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { input in
            let raw = try input.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: raw) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: raw) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: input.codingPath, debugDescription: "Invalid timestamp"))
        }
        return decoder
    }
}
