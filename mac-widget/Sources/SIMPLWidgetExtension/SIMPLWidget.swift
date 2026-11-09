import SwiftUI
import WidgetKit
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

struct TasksEntry: TimelineEntry {
    let date: Date
    let snapshot: TaskSnapshot
    let preferences: UserPreferences
}
struct TasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(date: Date(), snapshot: PreviewData.snapshot(), preferences: UserPreferences())
    }
    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        let store = SharedStore()
        completion(TasksEntry(date: Date(), snapshot: context.isPreview ? PreviewData.snapshot() : store.snapshot(),
                              preferences: store.preferences()))
    }
    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<TasksEntry>) -> Void) {
        Task {
            let result = await SIMPLEngine.shared.sync()
            let entry = TasksEntry(date: Date(), snapshot: result.snapshot, preferences: result.preferences)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60))))
        }
    }
}
struct SIMPLTasksWidget: Widget {
    let kind = "SIMPLTasks"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksProvider()) { entry in
            SIMPLWidgetView(snapshot: entry.snapshot, preferences: entry.preferences)
        }
        .configurationDisplayName("SIMPL Aufgaben")
        .description("Projekte und alle Karten durchsehen. Starten, abschließen, lesen und Kommentare öffnen.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
@main
struct SIMPLWidgets: WidgetBundle {
    var body: some Widget { SIMPLTasksWidget() }
}
