import SwiftUI
import WidgetKit
import AppKit
#if SWIFT_PACKAGE
import SIMPLCore
#endif

public struct SIMPLWidgetView: View {
    public let snapshot: TaskSnapshot
    public let preferences: UserPreferences
    @Environment(\.widgetFamily) private var systemFamily
    private let previewFamily: WidgetFamily?
    private var family: WidgetFamily { previewFamily ?? systemFamily }
    private var large: Bool { family == .systemLarge }
    private var pageSize: Int { large ? (preferences.textScale == .standard ? 4 : preferences.textScale == .large ? 3 : 2) : 1 }
    private var cards: [TaskCard] { Array(snapshot.visibleCards(preferences.widgetSection, preferences: preferences).prefix(pageSize)) }
    private var cardCount: Int { snapshot.visibleCards(preferences.widgetSection, preferences: preferences).count }
    private var projectName: String { snapshot.projects.first { $0.id == preferences.projectId }?.name ?? "Alle Projekte" }
    public init(snapshot: TaskSnapshot, preferences: UserPreferences, previewFamily: WidgetFamily? = nil) {
        self.snapshot = snapshot; self.preferences = preferences; self.previewFamily = previewFamily
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: large ? 10 : 8) {
            HStack(spacing: 6) {
                Link(destination: URL(string: "simplmac://open")!) {
                    HStack(spacing: 7) {
                        if let url = Bundle.main.url(forResource: "SIMPLMark", withExtension: "png"), let mark = NSImage(contentsOf: url) {
                            Image(nsImage: mark).resizable().renderingMode(.original).scaledToFit().frame(width: 20, height: 20).accessibilityHidden(true)
                        }
                        Text("SIMPL").simplFont(.headline).fontWeight(.semibold)
                    }
                }.buttonStyle(.plain)
                Spacer(minLength: 0)
                Button(intent: RefreshTasksIntent()) {
                    HStack(spacing: 5) {
                        if let date = snapshot.syncedAt, family != .systemSmall {
                            Text(date, format: .dateTime.hour().minute()).simplFont(.caption2).monospacedDigit()
                        }
                        Image(systemName: snapshot.errorMessage == nil ? "arrow.clockwise.circle" : "exclamationmark.circle")
                            .simplFont(.subheadline)
                    }.foregroundStyle(snapshot.errorMessage == nil ? Color.secondary.opacity(0.48) : Color.orange)
                }.buttonStyle(.plain).accessibilityLabel(snapshot.errorMessage ?? "SIMPL aktualisieren")
            }
            if snapshot.access != .ready {
                Spacer(minLength: 0)
                Text("Deine Aufgaben, direkt hier.").simplFont(.headline)
                Link(snapshot.access == .passwordChangeRequired ? "Passwort ändern" : "In SIMPL anmelden", destination: URL(string: "simplmac://open")!)
                    .simplFont(.caption).foregroundStyle(.tint)
                Spacer(minLength: 0)
            } else {
                projectSelector
                if large { sections }
                if preferences.hideWidgetTitles {
                    Spacer(minLength: 0)
                    Text("\(snapshot.visibleCards(preferences.widgetSection, preferences: preferences).count)")
                        .simplFont(.largeTitle).fontWeight(.semibold).contentTransition(.numericText())
                    Text(preferences.widgetSection.title).simplFont(.caption).foregroundStyle(.secondary)
                } else if cards.isEmpty {
                    Spacer(minLength: 0)
                    Text(preferences.widgetSection == .new ? "Alles gelesen" : "Keine Karten").simplFont(.subheadline).fontWeight(.medium)
                    Text(preferences.widgetSection == .new ? "Keine ungelesenen Karten." : preferences.filterLabelIds.isEmpty ? "Wähle ein anderes Projekt oder alle Aufgaben." : "Passe deine Label-Filter an.")
                        .simplFont(.caption).foregroundStyle(.secondary)
                } else {
                    VStack(spacing: large ? 8 : 0) {
                        ForEach(cards) { card in row(card) }
                    }
                }
                Spacer(minLength: 0)
                footer
            }
        }
        .padding(16)
        .privacySensitive()
        .environment(\.simplTextScale, preferences.textScale.multiplier)
        .containerBackground(.background, for: .widget)
        .widgetURL(URL(string: "simplmac://open"))
    }
    private var projectSelector: some View {
        HStack(spacing: 7) {
            if preferences.widgetSection == .new {
                Text("Alle Workspaces").simplFont(.caption).fontWeight(.medium)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Button(intent: BrowseTasksIntent(projectDirection: -1)) { Image(systemName: "chevron.left").simplFont(.caption2) }
                    .buttonStyle(.plain).foregroundStyle(.tertiary).accessibilityLabel("Vorheriges Projekt")
                Link(projectName, destination: URL(string: "simplmac://browse")!)
                    .simplFont(.caption).fontWeight(.medium).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading).buttonStyle(.plain)
                    .accessibilityLabel("Projekt öffnen: \(projectName)")
                Button(intent: BrowseTasksIntent(projectDirection: 1)) { Image(systemName: "chevron.right").simplFont(.caption2) }
                    .buttonStyle(.plain).foregroundStyle(.tertiary).accessibilityLabel("Nächstes Projekt")
            }
            if family != .systemSmall {
                Button(intent: BrowseTasksIntent(toggleScope: true)) { Text(preferences.onlyMyCards ? "Meine" : "Alle").simplFont(.caption2).padding(.horizontal, 5).padding(.vertical, 3).background(Color.primary.opacity(0.04), in: Capsule()) }
                    .buttonStyle(.plain).foregroundStyle(.secondary)
                    .accessibilityLabel(preferences.onlyMyCards ? "Alle Aufgaben anzeigen" : "Nur meine Aufgaben anzeigen")
            }
        }
    }
    private var sections: some View {
        HStack(spacing: 3) {
            ForEach(TaskSection.allCases, id: \.self) { section in
                Button(intent: BrowseTasksIntent(section: section.rawValue)) {
                    Text(section == .all ? "Alle" : section == .work ? "In Arbeit" : section.title)
                        .simplFont(.caption).lineLimit(1).minimumScaleFactor(0.8).fontWeight(preferences.widgetSection == section ? .semibold : .regular)
                        .frame(maxWidth: .infinity).padding(.vertical, 5)
                        .foregroundStyle(preferences.widgetSection == section ? Color.primary : Color.secondary)
                        .background(preferences.widgetSection == section ? Color.primary.opacity(0.065) : .clear, in: RoundedRectangle(cornerRadius: 7))
                }.buttonStyle(.plain).accessibilityLabel(section.title)
                    .accessibilityAddTraits(preferences.widgetSection == section ? .isSelected : [])
            }
        }
    }
    private var footer: some View {
        HStack(spacing: 8) {
            Link(large ? "Details & Kommentare" : "Öffnen", destination: URL(string: "simplmac://browse")!)
                .simplFont(.caption2).foregroundStyle(.secondary).buttonStyle(.plain)
            Spacer(minLength: 0)
            if cardCount > cards.count {
                Link("Alle \(cardCount)", destination: URL(string: "simplmac://browse")!)
                    .simplFont(.caption2).foregroundStyle(.secondary).buttonStyle(.plain)
                    .accessibilityLabel("Alle \(cardCount) Karten öffnen")
            }
        }
    }
    @ViewBuilder
    private func row(_ card: TaskCard) -> some View {
        if family == .systemSmall && preferences.widgetSection == .new { compactUnreadRow(card) }
        else { standardRow(card) }
    }
    private func compactUnreadRow(_ card: TaskCard) -> some View {
        let state = snapshot.section(of: card)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 7) {
                Button(intent: CompleteTaskIntent(cardId: card.id, completed: state != .done)) {
                    Image(systemName: state == .done ? "checkmark.circle.fill" : "circle").simplFont(.title3)
                        .foregroundStyle(state == .done ? Color.accentColor : Color.secondary.opacity(0.55))
                }.buttonStyle(.plain).accessibilityLabel(state == .done ? "\(card.title) wieder öffnen" : "\(card.title) abschließen")
                Link(destination: URL(string: "simplmac://card/\(card.id)")!) {
                    Text(card.title).simplFont(.subheadline).fontWeight(.medium).lineLimit(2)
                        .multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                }.buttonStyle(.plain).accessibilityLabel("Details und Kommentare: \(card.title)")
            }
            HStack(spacing: 3) {
                Text(snapshot.workspaceName(for: card)).simplFont(.caption2).foregroundStyle(.secondary).lineLimit(1)
                Spacer(minLength: 0)
                Button(intent: ReadCardIntent(cardId: card.id, updatedAt: snapshot.lastChange(of: card).timeIntervalSince1970)) {
                    Text("Gelesen").simplFont(.caption2).foregroundStyle(.secondary)
                }.buttonStyle(.plain).accessibilityLabel("\(card.title) als gelesen markieren")
            }.padding(.leading, 27)
        }
    }
    private func standardRow(_ card: TaskCard) -> some View {
        let state = snapshot.section(of: card)
        return HStack(alignment: .center, spacing: 9) {
            Button(intent: CompleteTaskIntent(cardId: card.id, completed: state != .done)) {
                Image(systemName: state == .done ? "checkmark.circle.fill" : "circle").simplFont(.title3)
                    .foregroundStyle(state == .done ? Color.accentColor : Color.secondary.opacity(0.55))
            }.buttonStyle(.plain).accessibilityLabel(state == .done ? "\(card.title) wieder öffnen" : "\(card.title) abschließen")
            Link(destination: URL(string: "simplmac://card/\(card.id)")!) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(card.title).simplFont(.subheadline).fontWeight(.medium).lineLimit(2).multilineTextAlignment(.leading)
                    HStack(spacing: 5) {
                        Text(preferences.widgetSection == .new ? snapshot.workspaceName(for: card) : state == .new ? "Offen" : state.title).simplFont(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        if large, let label = snapshot.labels(for: card).first {
                            Circle().fill(SIMPLStyle.color(label.color)).frame(width: 4, height: 4)
                            Text(label.name).simplFont(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.buttonStyle(.plain).accessibilityLabel("Details und Kommentare: \(card.title)")
            if large || preferences.widgetSection == .new {
                VStack(spacing: 4) {
                    if large && state == .new {
                        Button(intent: StartTaskIntent(cardId: card.id)) { Image(systemName: "play").simplFont(.caption).frame(width: 54, height: 18) }
                            .buttonStyle(.plain).foregroundStyle(.tertiary).accessibilityLabel("\(card.title) in Arbeit nehmen")
                    } else { Color.clear.frame(height: 18).accessibilityHidden(true) }
                    if snapshot.isUnread(card, preferences: preferences) {
                        Button(intent: ReadCardIntent(cardId: card.id, updatedAt: snapshot.lastChange(of: card).timeIntervalSince1970)) {
                            if preferences.widgetSection == .new {
                                Text("Gelesen").simplFont(.caption2).foregroundStyle(.secondary).frame(width: 54, height: 20)
                            } else {
                                Circle().fill(.blue).frame(width: 5, height: 5).frame(width: 54, height: 20)
                            }
                        }.buttonStyle(.plain).accessibilityLabel("\(card.title) als gelesen markieren")
                    } else { Color.clear.frame(width: 54, height: 20).accessibilityHidden(true) }
                }.frame(width: 54, height: 42)
            }
        }.frame(minHeight: large ? 44 : 30)
    }
}
