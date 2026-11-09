import SwiftUI
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

struct MainView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.openWindow) private var openWindow
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        Group {
            if model.snapshot.access == .ready {
                NavigationSplitView {
                    VStack(spacing: 0) {
                        Picker("Workspace", selection: Binding(get: { model.snapshot.workspaceId ?? "" }, set: { id in
                            Task { await model.change { $0.workspaceId = id } }
                        })) {
                            ForEach(model.snapshot.workspaces) { Text($0.name).tag($0.id) }
                        }.labelsHidden().padding(14)
                        PlainScrollView {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Aufgaben").simplFont(.caption).fontWeight(.semibold).foregroundStyle(.secondary).padding(.leading, 10).padding(.top, 8)
                                ForEach(TaskSection.allCases, id: \.self) { section in
                                    Button { model.section = section } label: {
                                        HStack(spacing: 9) {
                                            Label(section.title, systemImage: section.symbol)
                                            Spacer(minLength: 2)
                                            Text("\(model.snapshot.visibleCards(section, preferences: model.preferences).count)")
                                                .foregroundStyle(.tertiary).monospacedDigit().simplFont(.caption)
                                        }.padding(10).contentShape(Rectangle())
                                    }.buttonStyle(.plain)
                                    .background(model.section == section ? Color.accentColor.opacity(0.10) : .clear, in: RoundedRectangle(cornerRadius: 8))
                                    .accessibilityAddTraits(model.section == section ? .isSelected : [])
                                }
                                Text("Projekte").simplFont(.caption).fontWeight(.semibold).foregroundStyle(.secondary).padding(.leading, 10).padding(.top, 16).padding(.bottom, 4)
                                projectButton(nil, title: "Alle Projekte", symbol: "square.grid.2x2")
                                ForEach(model.snapshot.projects) { project in
                                    projectButton(project.id, title: project.name, symbol: model.snapshot.projectLabel(for: project.id) == nil ? "folder" : "tag")
                                }
                            }.padding(.horizontal, 10)
                        }.scrollIndicators(.hidden)
                        Picker("Karten", selection: Binding(get: { model.preferences.onlyMyCards }, set: { value in
                            Task { await model.change { $0.onlyMyCards = value } }
                        })) { Text("Alle").tag(false); Text("Meine").tag(true) }
                            .pickerStyle(.segmented).labelsHidden().controlSize(.small).padding(14)
                    }.navigationSplitViewColumnWidth(min: 185, ideal: 205, max: 250)
                } detail: {
                    GeometryReader { geometry in
                        let wide = geometry.size.width >= 710
                        HStack(spacing: 0) {
                            if wide || model.selectedCard == nil { TasksPane().frame(minWidth: 330, maxWidth: .infinity) }
                            if let card = model.selectedCard {
                                if wide { Divider() }
                                CardDetailView(card: card).id(card.id).frame(minWidth: 350, idealWidth: 390, maxWidth: wide ? 430 : .infinity)
                                    .transition(.move(edge: .trailing).combined(with: .opacity))
                            }
                        }.animation(reduceMotion ? nil : .smooth(duration: 0.22), value: model.selectedCardId)
                    }.clipped()
                }
            } else { LoginView() }
        }
        .frame(minWidth: 660, minHeight: 520)
        .toolbar {
            if model.snapshot.access == .ready {
                if model.section == .new {
                    Button("Alles gelesen", systemImage: "checkmark") { Task { await model.markViewed() } }
                        .disabled(model.busy || model.snapshot.visibleCards(.new, preferences: model.preferences).isEmpty)
                        .help("Markiert die ungelesenen Karten in allen deinen Workspaces auch in SIMPL als gelesen.")
                }
                Button { Task { await model.refresh() } } label: {
                    HStack(spacing: 6) {
                        if let date = model.snapshot.syncedAt { Text(date, format: .dateTime.hour().minute()).simplFont(.caption).monospacedDigit() }
                        Image(systemName: "arrow.clockwise.circle")
                    }.foregroundStyle(model.snapshot.errorMessage == nil ? Color.secondary.opacity(0.48) : Color.orange)
                }.disabled(model.busy).keyboardShortcut("r", modifiers: .command)
                    .help(model.snapshot.errorMessage ?? "Aktualisieren · Abgleich alle 30 Sekunden")
                    .accessibilityLabel("SIMPL aktualisieren")
                SettingsLink { Image(systemName: "slider.horizontal.3") }.help("Filter und Mitteilungen")
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let message = model.message {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.circle")
                    Text(message).simplFont(.callout)
                    Spacer()
                    Button("Erneut laden") { Task { await model.refresh() } }.disabled(model.busy)
                }.padding(12).background(.regularMaterial)
            }
        }
        .onOpenURL { url in
            if url.host == "card", let id = url.pathComponents.last, id != "/" { Task { await model.openCard(id) } }
            else {
                openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true)
                Task {
                    model.accept(await model.engine.cached())
                    if url.host == "browse" { model.closeCard(); model.search = ""; model.section = model.preferences.widgetSection }
                }
            }
        }
        .handlesExternalEvents(preferring: ["simplmac://"], allowing: ["simplmac://"])
        .onAppear {
            let action = openWindow
            model.showMainWindowAction = { action(id: "main") }
        }
    }
    private func projectButton(_ id: String?, title: String, symbol: String) -> some View {
        Button { model.section = .all; Task { await model.change { $0.projectId = id } } } label: {
            HStack {
                Label(title, systemImage: symbol).lineLimit(1)
                Spacer(minLength: 0)
                if model.preferences.projectId == id { Image(systemName: "checkmark").simplFont(.caption2).foregroundStyle(.tint) }
            }.padding(10).contentShape(Rectangle())
        }.buttonStyle(.plain).accessibilityLabel("Projekt: \(title)")
    }
}
struct TasksPane: View {
    @EnvironmentObject private var model: AppModel
    private var cards: [TaskCard] {
        model.snapshot.visibleCards(model.section, preferences: model.preferences).filter {
            model.search.isEmpty || $0.title.localizedCaseInsensitiveContains(model.search) || (model.snapshot.projectName(for: $0)?.localizedCaseInsensitiveContains(model.search) ?? false)
        }
    }
    private var projectName: String { model.section == .new ? "Alle Workspaces" : model.snapshot.projects.first { $0.id == model.preferences.projectId }?.name ?? model.snapshot.workspaceName }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(projectName).simplFont(.caption).foregroundStyle(.secondary).lineLimit(1)
                        Text(model.section.title).simplFont(.title2).fontWeight(.semibold)
                    }
                    Spacer()
                    Text("\(cards.count)").simplFont(.title3).foregroundStyle(.tertiary).monospacedDigit()
                }
                HStack(spacing: 7) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.tertiary)
                    TextField("Karten suchen", text: $model.search).textFieldStyle(.plain)
                    if !model.search.isEmpty { Button { model.search = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }.buttonStyle(.plain).accessibilityLabel("Suche löschen") }
                }.padding(9).background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
                if model.section == .new { Text("Alle Karten ohne Gelesen-Markierung in deinen Workspaces.").simplFont(.caption).foregroundStyle(.secondary) }
                if model.section != .new && !model.preferences.filterLabelIds.isEmpty {
                    HStack {
                        Text("\(model.preferences.filterLabelIds.count) Label-Filter aktiv").simplFont(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Button("Zurücksetzen") { Task { await model.change { $0.filterLabelIds = [] } } }.buttonStyle(.link).simplFont(.caption)
                    }
                }
            }.padding(20)
            Divider().opacity(0.5)
            if cards.isEmpty {
                ContentUnavailableView(model.search.isEmpty && model.section == .new ? "Alles gelesen" : "Keine Karten",
                    systemImage: model.section == .new ? "checkmark.circle" : "rectangle.stack",
                    description: Text(model.search.isEmpty ? model.section == .new ? "Alle Karten sind als gelesen markiert." : "Wähle ein anderes Projekt oder passe deine Filter an." : "Keine Karte passt zu deiner Suche."))
            } else {
                PlainScrollView {
                    VStack(spacing: 0) {
                        ForEach(cards) { card in
                            DesktopTaskRow(card: card).padding(.horizontal, 16)
                                .background(model.selectedCardId == card.id ? Color.accentColor.opacity(0.07) : .clear, in: RoundedRectangle(cornerRadius: 8))
                            Divider().opacity(0.35).padding(.leading, 48).padding(.trailing, 16)
                        }
                    }.padding(.horizontal, 4).padding(.vertical, 8)
                }.scrollIndicators(.hidden)
            }
            if model.previewMode {
                Text("Designvorschau · lokale Beispieldaten").simplFont(.caption).foregroundStyle(.tertiary).padding(16)
            }
        }.navigationTitle("SIMPL")
    }
}
struct DesktopTaskRow: View {
    @EnvironmentObject private var model: AppModel
    let card: TaskCard
    private var state: TaskSection { model.snapshot.section(of: card) }
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Button { Task { await model.perform(card) } } label: {
                Image(systemName: state == .done ? "checkmark.circle.fill" : "circle")
                    .simplFont(.title3).foregroundStyle(state == .done ? Color.accentColor : Color.secondary.opacity(0.5))
            }.buttonStyle(.plain).disabled(model.busy)
                .help(state == .done ? "Wieder öffnen" : "Auf Fertig setzen")
                .accessibilityLabel(state == .done ? "\(card.title) wieder öffnen" : "\(card.title) abschließen")
            Button { Task { await model.openCard(card.id) } } label: {
                VStack(alignment: .leading, spacing: 6) {
                    Text(card.title).simplFont(.body).fontWeight(.medium).lineLimit(2).multilineTextAlignment(.leading)
                    TaskListMetadata(card: card, snapshot: model.snapshot, showWorkspace: model.section == .new)
                }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityLabel("Karte öffnen: \(card.title)")
            VStack(spacing: 8) {
                Menu {
                Button("Details und Kommentare") { Task { await model.openCard(card.id) } }
                if state == .new { Button("In Arbeit nehmen") { Task { await model.perform(card, start: true) } } }
                Button(state == .done ? "Wieder öffnen" : "Auf Fertig setzen") { Task { await model.perform(card) } }
                Button("Als gelesen markieren") { Task { await model.markRead(card) } }
                if !model.previewMode { Button("Im Browser öffnen") { Task { await model.openCardInWeb(card.id) } } }
            } label: { Image(systemName: "ellipsis").foregroundStyle(.tertiary) }
                .menuStyle(.borderlessButton).frame(width: 60, height: 18).disabled(model.busy)
                .accessibilityLabel("Aktionen für \(card.title)")
                if model.snapshot.isUnread(card, preferences: model.preferences) {
                    Button { Task { await model.markRead(card) } } label: {
                        if model.section == .new {
                            Text("Gelesen").simplFont(.caption).foregroundStyle(.secondary).frame(width: 60, height: 20)
                        } else { Circle().fill(.blue).frame(width: 6, height: 6).frame(width: 60, height: 20) }
                    }.buttonStyle(.plain).help("Als gelesen markieren").accessibilityLabel("\(card.title) als gelesen markieren")
                } else { Color.clear.frame(width: 60, height: 20).accessibilityHidden(true) }
            }.frame(width: 60, height: 46)
        }.padding(.vertical, 10)
    }
}
struct LoginView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "checklist").simplFont(.largeTitle).foregroundStyle(.tint)
            Text("Deine Aufgaben. Direkt hier.").simplFont(.title2).fontWeight(.semibold)
            Text("Melde dich mit deinem SIMPL-Konto an.").simplFont(.callout).foregroundStyle(.secondary)
            if model.snapshot.access == .passwordChangeRequired {
                Text("Ändere zuerst dein Startpasswort in SIMPL.").simplFont(.callout)
                Button("SIMPL öffnen") { Task { await model.openWeb() } }
                Button("Passwort geändert · neu laden") { Task { await model.refresh() } }.disabled(model.busy)
            } else {
                VStack(spacing: 12) {
                    TextField("E-Mail", text: $model.loginEmail).textContentType(.username)
                    SecureField("Passwort", text: $model.loginPassword).textContentType(.password)
                        .onSubmit { Task { await model.signIn() } }
                    Button(model.busy ? "Anmeldung läuft …" : "Anmelden") { Task { await model.signIn() } }
                        .buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
                        .disabled(model.busy || model.loginEmail.isEmpty || model.loginPassword.isEmpty)
                }.textFieldStyle(.roundedBorder).frame(maxWidth: 290)
            }
            Text("Die Anmeldung wird sicher im macOS Schlüsselbund gespeichert.")
                .simplFont(.caption).foregroundStyle(.secondary)
        }.padding(36).frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
struct PreferencesView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        Form {
            Section("Ansicht") {
                Picker("Textgröße für App und Widget", selection: Binding(get: { model.preferences.textScale }, set: { value in
                    Task { await model.change { $0.textScale = value } }
                })) { ForEach(UserPreferences.TextScale.allCases, id: \.self) { Text($0.title).tag($0) } }
                Toggle("Nur meine Aufgaben", isOn: Binding(get: { model.preferences.onlyMyCards },
                    set: { value in Task { await model.change { $0.onlyMyCards = value } } }))
                Toggle("Aufgabentitel im Widget ausblenden", isOn: Binding(get: { model.preferences.hideWidgetTitles },
                    set: { value in Task { await model.change { $0.hideWidgetTitles = value } } }))
                Text("Systemschrift und macOS-Erscheinungsbild. Die Textgröße gilt gemeinsam für App und Widget. „Neu“ verwendet den gemeinsamen Gelesen-Status aus SIMPL. Standardmäßig siehst du alle Karten; „Meine“ ist optional.").simplFont(.caption).foregroundStyle(.secondary)
            }
            Section("Labels filtern") {
                if model.snapshot.labels.isEmpty { Text("Labels erscheinen nach der Anmeldung.").foregroundStyle(.secondary) }
                ForEach(model.snapshot.labels.filter { $0.workspaceId == model.snapshot.workspaceId }) { label in
                    Toggle(isOn: Binding(get: { model.preferences.filterLabelIds.contains(label.id) }, set: { value in
                        Task { await model.change { if value { $0.filterLabelIds.insert(label.id) } else { $0.filterLabelIds.remove(label.id) } } }
                    })) { LabelChip(label) }
                }
            }
            Section("Mitteilungen") {
                Toggle("SIMPL-Mitteilungen erlauben", isOn: Binding(get: { model.preferences.notificationsEnabled },
                    set: { value in Task { await model.setNotifications(value) } }))
                Toggle("Auch neue Kommentare melden", isOn: Binding(get: { model.preferences.notifyOnComments },
                    set: { value in Task { await model.change({ $0.notifyOnComments = value }, subscriptions: true) } }))
                    .disabled(!model.preferences.notificationsEnabled)
                Toggle("Freigaben melden", isOn: Binding(get: { model.preferences.notifyOnApprovals }, set: { value in
                    Task { await model.change({ $0.notifyOnApprovals = value }, subscriptions: true) }
                })).disabled(!model.preferences.notificationsEnabled)
                Toggle("Archivierte Karten melden", isOn: Binding(get: { model.preferences.notifyOnArchives }, set: { value in
                    Task { await model.change({ $0.notifyOnArchives = value }, subscriptions: true) }
                })).disabled(!model.preferences.notificationsEnabled)
                if !model.previewMode { Button("Testmitteilung anzeigen") { Task { await model.testNotification() } }.disabled(!model.preferences.notificationsEnabled) }
                Text("In allen deinen Workspaces. Projekt- und Label-Filter gelten nur für die Ansicht. SIMPL prüft alle 30 Sekunden und nach dem Aufwachen des Mac.")
                    .simplFont(.caption).foregroundStyle(.secondary)
            }
            Section("Mac") {
                Toggle("SIMPL bei der Anmeldung starten", isOn: Binding(get: { model.loginAtLaunch }, set: model.setLaunchAtLogin))
                    .disabled(model.previewMode)
                if SharedLocation.groupContainer == nil {
                    Text("Die Desktop-Widget-Verbindung wird mit dem signierten Xcode-Build aktiviert.")
                        .simplFont(.caption).foregroundStyle(.secondary)
                }
                if model.snapshot.access == .ready && !model.previewMode {
                    Button("Von diesem Mac abmelden", role: .destructive) { Task { await model.signOut() } }
                }
            }
            if let message = model.message { Text(message).simplFont(.callout).foregroundStyle(.secondary) }
        }
        .formStyle(.grouped).scrollIndicators(.hidden).frame(width: 440, height: 620).disabled(model.busy)
    }
}
struct MenuView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.openWindow) private var openWindow
    var body: some View {
        Button("SIMPL öffnen") { openWindow(id: "main"); NSApp.activate(ignoringOtherApps: true) }
        if model.snapshot.access == .ready {
            Text("\(model.snapshot.visibleCards(.new, preferences: model.preferences).count) neue Änderungen")
            Button("Alles gesehen") { Task { await model.markViewed() } }
            Button("Aktualisieren") { Task { await model.refresh() } }.disabled(model.busy)
        }
        Divider()
        if model.previewMode { Button("Widget-Vorschau") { openWindow(id: "widgets") } }
        SettingsLink()
        Button("SIMPL beenden") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}
