import SwiftUI
import WidgetKit
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

/// A layout review with sample data. This window does not register a widget and
/// cannot run AppIntent actions against a real account.
@MainActor
private final class WidgetPreviewSettings: ObservableObject {
    @Published var section = TaskSection.all
    @Published var dark = false
    @Published var largeText = false
}
struct WidgetPreviewView: View {
    @StateObject private var settings = WidgetPreviewSettings()
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("SIMPL für deinen Desktop").simplFont(.title2).fontWeight(.semibold)
                    Text("Layout-Vorschau · lokale Beispieldaten").simplFont(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                Picker("Ansicht", selection: $settings.section) {
                    ForEach(TaskSection.allCases, id: \.self) { Text($0.title).tag($0) }
                }.frame(width: 140)
                Toggle("Dunkel", isOn: $settings.dark)
                Toggle("Große Schrift", isOn: $settings.largeText)
            }
            HStack(alignment: .top, spacing: 20) {
                sample(.systemSmall, title: "Klein", width: 165, height: 165)
                sample(.systemMedium, title: "Mittel", width: 340, height: 165)
                sample(.systemLarge, title: "Groß", width: 340, height: 360)
            }
            Spacer(minLength: 0)
            Text("Die Widget-Galerie, echten Desktop-Aktionen und Anmeldung werden mit dem signierten Xcode-Build geprüft.")
                .simplFont(.caption).foregroundStyle(.secondary)
        }
        .padding(24).preferredColorScheme(settings.dark ? .dark : .light)
    }
    private func sample(_ family: WidgetFamily, title: String, width: CGFloat, height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).simplFont(.headline).foregroundStyle(.secondary)
            SIMPLWidgetView(snapshot: PreviewData.snapshot(), preferences: preferences, previewFamily: family)
                .frame(width: width, height: height)
                .background(.background, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(.quaternary))
                .allowsHitTesting(false)
        }
    }
    private var preferences: UserPreferences {
        var value = UserPreferences()
        value.widgetSection = settings.section
        value.textScale = settings.largeText ? .extraLarge : .standard
        return value
    }
}
