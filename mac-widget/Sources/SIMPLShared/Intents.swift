import AppIntents
import WidgetKit
#if SWIFT_PACKAGE
import SIMPLCore
#endif

public struct CompleteTaskIntent: AppIntent {
    public static let title: LocalizedStringResource = "Aufgabe abschließen"
    public static let description = IntentDescription("Setzt die Aufgabe in SIMPL auf Fertig oder öffnet sie wieder.")
    @Parameter(title: "Aufgabe") public var cardId: String
    @Parameter(title: "Fertig") public var completed: Bool
    public init() {}
    public init(cardId: String, completed: Bool) { self.cardId = cardId; self.completed = completed }
    public func perform() async throws -> some IntentResult {
        let result = await SIMPLEngine.shared.perform(cardId: cardId, complete: completed)
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        if let message = result.snapshot.errorMessage { throw IntentFailure(message: message) }
        return .result()
    }
}
public struct StartTaskIntent: AppIntent {
    public static let title: LocalizedStringResource = "In Arbeit nehmen"
    @Parameter(title: "Aufgabe") public var cardId: String
    public init() {}
    public init(cardId: String) { self.cardId = cardId }
    public func perform() async throws -> some IntentResult {
        let result = await SIMPLEngine.shared.perform(cardId: cardId, start: true)
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        if let message = result.snapshot.errorMessage { throw IntentFailure(message: message) }
        return .result()
    }
}
public struct MarkViewedIntent: AppIntent {
    public static let title: LocalizedStringResource = "Alles gesehen"
    public init() {}
    public func perform() async throws -> some IntentResult {
        _ = try await SIMPLEngine.shared.markViewed()
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        return .result()
    }
}
public struct RefreshTasksIntent: AppIntent {
    public static let title: LocalizedStringResource = "SIMPL aktualisieren"
    public init() {}
    public func perform() async throws -> some IntentResult {
        _ = await SIMPLEngine.shared.sync()
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        return .result()
    }
}
private struct IntentFailure: LocalizedError {
    var message: String
    var errorDescription: String? { message }
}

public struct ReadCardIntent: AppIntent {
    public static let title: LocalizedStringResource = "Karte als gelesen markieren"
    @Parameter(title: "Karte") public var cardId: String
    @Parameter(title: "Gesehene Aktualisierung") public var updatedAt: Double
    public init() { updatedAt = 0 }
    public init(cardId: String, updatedAt: Double) { self.cardId = cardId; self.updatedAt = updatedAt }
    public func perform() async throws -> some IntentResult {
        _ = try await SIMPLEngine.shared.markCardRead(cardId, through: Date(timeIntervalSince1970: updatedAt))
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        return .result()
    }
}
public struct BrowseTasksIntent: AppIntent {
    public static let title: LocalizedStringResource = "Aufgaben durchsehen"
    @Parameter(title: "Projektrichtung") public var projectDirection: Int
    @Parameter(title: "Seitenrichtung") public var pageDirection: Int
    @Parameter(title: "Ansicht") public var section: String
    @Parameter(title: "Karten pro Seite") public var pageSize: Int
    @Parameter(title: "Meine oder alle") public var toggleScope: Bool
    public init() { projectDirection = 0; pageDirection = 0; section = ""; pageSize = 4; toggleScope = false }
    public init(projectDirection: Int = 0, pageDirection: Int = 0, section: String = "", pageSize: Int = 4, toggleScope: Bool = false) {
        self.projectDirection = projectDirection; self.pageDirection = pageDirection; self.section = section; self.pageSize = pageSize; self.toggleScope = toggleScope
    }
    public func perform() async throws -> some IntentResult {
        _ = try await SIMPLEngine.shared.navigateWidget(projectDirection: projectDirection, pageDirection: pageDirection,
            section: TaskSection(rawValue: section), pageSize: pageSize, toggleScope: toggleScope)
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        return .result()
    }
}
public struct ClearViewFiltersIntent: AppIntent {
    public static let title: LocalizedStringResource = "Label-Filter zurücksetzen"
    public init() {}
    public func perform() async throws -> some IntentResult {
        var preferences = await SIMPLEngine.shared.cached().preferences
        preferences.filterLabelIds = []; preferences.widgetPage = 0
        _ = try await SIMPLEngine.shared.updatePreferences(preferences)
        WidgetCenter.shared.reloadTimelines(ofKind: "SIMPLTasks")
        return .result()
    }
}
