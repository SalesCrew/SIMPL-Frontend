import SwiftUI
#if SWIFT_PACKAGE
import SIMPLShared
#endif

@main
struct SIMPLDesktopApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene {
        Window("SIMPL", id: "main") {
            MainView().environmentObject(model).tint(.green)
                .simplFont(.body)
                .environment(\.simplTextScale, model.preferences.textScale.multiplier)
        }
        .defaultSize(width: 1040, height: 680)
        .handlesExternalEvents(matching: ["simplmac://"])
        .commands { CommandGroup(replacing: .newItem) {} }
        Settings {
            PreferencesView().environmentObject(model).tint(.green)
                .simplFont(.body)
                .environment(\.simplTextScale, model.preferences.textScale.multiplier)
        }
        #if DEBUG
        Window("SIMPL Widget-Vorschau", id: "widgets") { WidgetPreviewView() }
            .defaultSize(width: 940, height: 580)
        #endif
        MenuBarExtra("SIMPL", systemImage: "checklist") { MenuView().environmentObject(model) }
    }
}
