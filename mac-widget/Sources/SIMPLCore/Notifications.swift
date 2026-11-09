import Foundation

public struct LocalAlert: Codable, Equatable, Identifiable, Sendable {
    public var id: String
    public var cardId: String
    public var title: String
    public var body: String
    public var workspaceId: String? = nil
}

public enum AlertPolicy {
    public static func evaluate(snapshot: TaskSnapshot, preferences: inout UserPreferences) -> [LocalAlert] {
        guard snapshot.access == .ready, let profile = snapshot.profile else { return [] }
        let accessible = Set(snapshot.workspaces.map(\.id))
        let newWorkspaces = accessible.subtracting(preferences.notificationWorkspaceIds)
        defer { preferences.notificationWorkspaceIds = accessible }
        let activities = snapshot.activities.filter { $0.recipientId == profile.id && accessible.contains($0.workspaceId) }
        let ids = Set(activities.map(\.id))
        let approvalLabels = Set(snapshot.labels.filter { $0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "freigegeben" }.map(\.id))
        let approved = snapshot.cards.filter { $0.isActive && accessible.contains($0.workspaceId) && !approvalLabels.isDisjoint(with: $0.labelIds) }
        let approvedIds = Set(approved.map(\.id))
        let newlyApproved = preferences.approvalBaselineEstablished ? approved.filter { !newWorkspaces.contains($0.workspaceId) && !preferences.knownApprovedCardIds.contains($0.id) } : []
        defer { preferences.knownApprovedCardIds = approvedIds; preferences.approvalBaselineEstablished = true }
        guard preferences.notificationBaselineEstablished else {
            preferences.deliveredActivityIds = ids
            preferences.notificationBaselineEstablished = true
            return []
        }
        let unseen = activities.filter { !newWorkspaces.contains($0.workspaceId) && !preferences.deliveredActivityIds.contains($0.id) }
        preferences.deliveredActivityIds = ids.union(preferences.deliveredActivityIds)
        if preferences.deliveredActivityIds.count > 6000 { preferences.deliveredActivityIds = ids }
        guard preferences.notificationsEnabled else { return [] }
        func workspaceName(_ id: String) -> String { snapshot.workspaces.first { $0.id == id }?.name ?? "SIMPL" }
        var alerts = unseen.sorted { $0.createdAt < $1.createdAt }.compactMap { activity -> LocalAlert? in
            guard activity.actorId != profile.id else { return nil }
            let cardId = activity.cardId ?? ""
            let title: String
            switch activity.eventType {
            case "card.created": title = "Neue Karte"
            case "comment.created" where preferences.notifyOnComments: title = "Neuer Kommentar"
            case "card.archived" where preferences.notifyOnArchives: title = "Karte archiviert"
            default: return nil
            }
            let cardTitle = activity.subject.isEmpty ? snapshot.cards.first { $0.id == cardId }?.title ?? "Karte" : activity.subject
            // Notification metadata survives archiving. No active-card or view
            // filter is required; membership is checked for every event.
            return LocalAlert(id: activity.id, cardId: cardId, title: "\(title) · \(workspaceName(activity.workspaceId))",
                body: cardTitle, workspaceId: activity.workspaceId)
        }
        if preferences.notifyOnApprovals {
            alerts += newlyApproved.map { card in
                LocalAlert(id: "approval-\(card.id)-\(card.updatedAt.timeIntervalSince1970)", cardId: card.id,
                    title: "Freigegeben · \(workspaceName(card.workspaceId))", body: card.title, workspaceId: card.workspaceId)
            }
        }
        return alerts
    }
}

public struct SyncResult: Sendable {
    public var snapshot: TaskSnapshot
    public var preferences: UserPreferences
    public var alerts: [LocalAlert]
    public init(snapshot: TaskSnapshot, preferences: UserPreferences, alerts: [LocalAlert] = []) {
        self.snapshot = snapshot; self.preferences = preferences; self.alerts = alerts
    }
}
