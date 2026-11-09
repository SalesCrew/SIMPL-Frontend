import Foundation

public enum PreviewData {
    public static func snapshot() -> TaskSnapshot {
        let now = Date()
        let person = "preview-user"
        let workspace = "preview-workspace"
        let project = "preview-project"
        var value = TaskSnapshot()
        value.access = .ready; value.isPreview = true; value.workspaceId = workspace; value.syncedAt = now
        value.profile = Profile(id: person, name: "Kilian", email: "", role: "mitarbeiter",
                                defaultWorkspaceId: workspace, active: true)
        value.workspaces = [Workspace(id: workspace, name: "Mein Workspace")]
        value.columns = [
            BoardColumn(id: project, workspaceId: workspace, name: "Wochenplanung", kind: .project),
            BoardColumn(id: "preview-work", workspaceId: workspace, name: "In Arbeit", kind: .work),
            BoardColumn(id: "preview-done", workspaceId: workspace, name: "Fertig", kind: .done),
        ]
        value.labels = [
            TaskLabel(id: "preview-focus", workspaceId: workspace, name: "Fokus", color: "green"),
            TaskLabel(id: "preview-feedback", workspaceId: workspace, name: "Feedback", color: "blue"),
            TaskLabel(id: "preview-today", workspaceId: workspace, name: "Heute", color: "orange"),
        ]
        value.cards = [
            TaskCard(id: "preview-1", workspaceId: workspace, title: "Wochenplanung abstimmen",
                     columnId: project, projectId: project, createdBy: "someone-else", assigneeId: person,
                     createdAt: now.addingTimeInterval(-900), updatedAt: now.addingTimeInterval(-60), labelIds: ["preview-focus", "preview-today"]),
            TaskCard(id: "preview-2", workspaceId: workspace, title: "Feedback zum Entwurf",
                     columnId: project, projectId: project, createdBy: person, assigneeId: person,
                     createdAt: now.addingTimeInterval(-3600), updatedAt: now.addingTimeInterval(-120), labelIds: ["preview-feedback"]),
            TaskCard(id: "preview-3", workspaceId: workspace, title: "Nächste Schritte vorbereiten",
                     columnId: "preview-work", projectId: project, createdBy: person, assigneeId: person,
                     position: 1, updatedAt: now.addingTimeInterval(-600), labelIds: ["preview-focus"]),
            TaskCard(id: "preview-4", workspaceId: workspace, title: "Unterlagen durchsehen",
                     columnId: "preview-done", projectId: project, createdBy: person,
                     completedAt: now.addingTimeInterval(-7200), updatedAt: now.addingTimeInterval(-7200), labelIds: ["preview-today"]),
        ]
        value.cards[0].description = "Plane die kommende Woche: Prioritäten abstimmen, offene Punkte sammeln und die nächsten Schritte mit dem Team festlegen."
        return value
    }
}
