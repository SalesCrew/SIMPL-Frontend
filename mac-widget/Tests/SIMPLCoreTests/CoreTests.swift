import Foundation
import Testing
@testable import SIMPLCore

struct CoreTests {
    @Test func inkognitoSidebarOptionUsesOnlyItsExistingLabelAcrossProjects() throws {
        var snapshot = PreviewData.snapshot()
        let labelID = "91984a63-b73b-49f5-b34b-ca4ed773834c"
        let workspace = try #require(snapshot.workspaceId)
        snapshot.labels.append(TaskLabel(id: labelID, workspaceId: workspace, name: "Inkognito", color: "sand"))
        snapshot.cards[0].labelIds.append(labelID)
        snapshot.cards[0].projectId = "unrelated-project"
        snapshot.cards[1].title = "Inkognito"
        snapshot.cards[1].projectId = "Inkognito"
        let option = try #require(snapshot.projects.first { $0.id == "label:" + labelID })
        #expect(option.name == "Inkognito")
        #expect(snapshot.projectLabel(for: option.id)?.id == labelID)
        var preferences = UserPreferences(); preferences.projectId = option.id
        #expect(snapshot.visibleCards(.all, preferences: preferences).map(\.id) == [snapshot.cards[0].id])
        #expect(snapshot.visibleCards(.new, preferences: preferences).count == snapshot.cards.count)
        preferences.projectId = "label:unknown"
        #expect(snapshot.visibleCards(.all, preferences: preferences).isEmpty)
    }
    @Test func inkognitoLabelSelectionIsScopedAndSurvivesPreferenceRoundtrip() throws {
        var snapshot = PreviewData.snapshot()
        let labelID = "91984a63-b73b-49f5-b34b-ca4ed773834c"
        snapshot.labels.append(TaskLabel(id: "another-label", workspaceId: try #require(snapshot.workspaceId), name: "Inkognito"))
        snapshot.labels.append(TaskLabel(id: labelID, workspaceId: "other-workspace", name: "Inkognito"))
        #expect(!snapshot.projects.contains { $0.id.hasPrefix("label:") })
        snapshot.labels.append(TaskLabel(id: labelID, workspaceId: try #require(snapshot.workspaceId), name: "Updated label name", color: "sand"))
        snapshot.cards[0].labelIds.append(labelID)
        var preferences = UserPreferences(); preferences.projectId = "label:" + labelID
        let restored = try JSONDecoder().decode(UserPreferences.self, from: JSONEncoder().encode(preferences))
        #expect(snapshot.projects.last?.name == "Updated label name")
        #expect(snapshot.visibleCards(.all, preferences: restored).map(\.id) == [snapshot.cards[0].id])
        snapshot.labels.removeAll { $0.workspaceId == snapshot.workspaceId && $0.id == labelID }
        #expect(snapshot.visibleCards(.all, preferences: restored).isEmpty)
    }
    @Test func testOlderPreferencesKeepFiltersWhenTextScaleIsAdded() throws {
        let data = Data(#"{"filterLabelIds":["focus"],"onlyMyCards":false}"#.utf8)
        let value = try JSONDecoder().decode(UserPreferences.self, from: data)
        #expect(value.textScale == .standard)
        #expect(value.filterLabelIds == ["focus"])
        #expect(value.onlyMyCards == false)
    }
    @Test func testInboxIgnoresLabelFiltersAndAcknowledgesAllUnreadCards() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let engine = SIMPLEngine(store: SharedStore(directory: directory), sessions: MemorySessionStore(), preview: true)
        var result = try await engine.preview()
        result.preferences.filterLabelIds = ["preview-feedback"]
        _ = try await engine.updatePreferences(result.preferences)
        result = try await engine.markViewed()
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).isEmpty)
        result.preferences.filterLabelIds = []
        result = try await engine.updatePreferences(result.preferences)
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).isEmpty)
    }
    @Test func testRecentInboxIncludesChangesToWorkAndDone() {
        let snapshot = PreviewData.snapshot()
        var preferences = UserPreferences()
        #expect(Set(snapshot.visibleCards(.new, preferences: preferences).map(\.id)) == Set(snapshot.cards.map(\.id)))
        preferences.lastViewedAt = snapshot.cards.map(\.updatedAt).max()
        #expect(snapshot.visibleCards(.new, preferences: preferences).count == 4)
        #expect(snapshot.visibleCards(.work, preferences: preferences).count == 1)
        #expect(snapshot.visibleCards(.done, preferences: preferences).count == 1)
    }
    @Test func unreadInboxCoversMembershipsAndKeepsMineOptional() {
        var snapshot = PreviewData.snapshot()
        snapshot.workspaces.append(Workspace(id: "other-workspace", name: "Another team"))
        var other = snapshot.cards[0]; other.id = "other-card"; other.workspaceId = "other-workspace"
        other.assigneeId = "other-member"; other.createdBy = "other-member"
        snapshot.cards.append(other)
        var archived = other; archived.id = "archived"; archived.archivedAt = Date(); snapshot.cards.append(archived)
        var revoked = other; revoked.id = "revoked"; revoked.workspaceId = "inaccessible"; snapshot.cards.append(revoked)
        var prefs = UserPreferences(); prefs.projectId = "non-matching-project"; prefs.filterLabelIds = ["non-matching-label"]
        prefs.newMode = .projectCards // The obsolete setting must not change the unread inbox.
        #expect(Set(snapshot.visibleCards(.new, preferences: prefs).map(\.id)) == Set(snapshot.cards.prefix(5).map(\.id)))
        #expect(snapshot.visibleCards(.all, preferences: prefs).isEmpty)
        prefs.onlyMyCards = true
        #expect(snapshot.visibleCards(.new, preferences: prefs).count == 4)
        prefs.onlyMyCards = false
        snapshot.cards[4].reviewedAt = Date(); snapshot.cards[4].reviewedBy = "other-member"
        #expect(!snapshot.visibleCards(.new, preferences: prefs).contains { $0.id == other.id })
    }
    @Test func allCardsIsTheDefaultForNewAndOlderPreferences() throws {
        #expect(!UserPreferences().onlyMyCards)
        #expect(!(try JSONDecoder().decode(UserPreferences.self, from: Data("{}".utf8))).onlyMyCards)
        let mine = try JSONDecoder().decode(UserPreferences.self, from: Data(#"{"onlyMyCards":true}"#.utf8))
        #expect(mine.onlyMyCards)
    }
    @Test func personalCheckpointsDoNotOverrideTheSharedReadStatus() {
        var snapshot = PreviewData.snapshot()
        var prefs = UserPreferences(); prefs.lastViewedAt = Date()
        prefs.seenCardUpdates = Dictionary(uniqueKeysWithValues: snapshot.cards.map { ($0.id, Date()) })
        #expect(snapshot.visibleCards(.new, preferences: prefs).count == 4)
        snapshot.cards[0].reviewedAt = Date(); snapshot.cards[0].reviewedBy = "colleague"
        #expect(snapshot.visibleCards(.new, preferences: prefs).count == 3)
        #expect(!snapshot.isUnread(snapshot.cards[0], preferences: prefs))
    }
    @Test func testNotificationBaselineSelfEventsAndReplay() {
        var snapshot = PreviewData.snapshot()
        var preferences = UserPreferences()
        preferences.notificationsEnabled = true; preferences.watchedLabelIds = ["preview-focus"]
        func event(_ id: String, actor: String = "other", type: String = "comment.created") -> Activity {
            Activity(id: id, recipientId: "preview-user", actorId: actor, workspaceId: "preview-workspace",
                     cardId: "preview-1", eventType: type, subject: "", createdAt: Date())
        }
        snapshot.activities = [event("old")]
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &preferences).isEmpty)
        snapshot.activities += [event("new"), event("self", actor: "preview-user"), event("ignored", type: "card.updated")]
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &preferences).map(\.id) == ["new"])
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &preferences).isEmpty)
    }
    @Test func testPrivateCachePermissionsAndClear() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        try store.save(PreviewData.snapshot())
        let attributes = try FileManager.default.attributesOfItem(atPath: directory.appendingPathComponent("snapshot.json").path)
        #expect((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o600)
        _ = try store.removePrivateData()
        #expect(store.snapshot().cards.isEmpty)
        #expect(store.pendingAlerts().isEmpty)
    }
    @Test func testPreviewStartCompleteReopenAndSeenAreLocal() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let engine = SIMPLEngine(store: SharedStore(directory: directory), sessions: MemorySessionStore(), preview: true)
        _ = try await engine.preview()
        var result = await engine.perform(cardId: "preview-1", start: true)
        #expect(result.snapshot.section(of: try  #require(result.snapshot.cards.first { $0.id == "preview-1" })) == .work)
        result = await engine.perform(cardId: "preview-1", complete: true)
        #expect(result.snapshot.section(of: try  #require(result.snapshot.cards.first { $0.id == "preview-1" })) == .done)
        result = await engine.perform(cardId: "preview-1", complete: false)
        #expect(result.snapshot.section(of: try  #require(result.snapshot.cards.first { $0.id == "preview-1" })) == .new)
        result = try await engine.markViewed()
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).isEmpty)
    }
    @Test func testWireDatesAndServiceKeyRejection() throws {
        let json = Data(#"{"id":"c","workspace_id":"w","title":"T","column_id":"p","created_by":"u","position":0,"created_at":"2026-10-01T10:00:00.123456Z","updated_at":"2026-10-01T10:01:00Z","label_ids":[]}"#.utf8)
        let card = try WireJSON.decoder().decode(TaskCard.self, from: json)
        #expect(card.workspaceId == "w")
        #expect(card.updatedAt > card.createdAt)
        #expect(throws: SIMPLError.configurationRejected) { try ServiceConfiguration(supabaseURL: URL(string: "https://xqvexzoswhraqicbmckj.supabase.co")!,
            publishableKey: "sb_secret_invalid", apiURL: URL(string: "https://example.com")!, appURL: URL(string: "https://example.com")!) }
    }
}

struct DesktopFlowTests {
    @Test func anArchivedThenDeletedCardStillProducesItsRetainedNotification() {
        var snapshot = PreviewData.snapshot()
        var prefs = UserPreferences(); prefs.notificationsEnabled = true
        _ = AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs)
        snapshot.activities.append(Activity(id: "archived-then-deleted", recipientId: "preview-user", actorId: "colleague", workspaceId: "preview-workspace", cardId: nil, eventType: "card.archived", subject: "Archived task", createdAt: Date()))
        let alert = AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).first
        #expect(alert?.body == "Archived task")
        #expect(alert?.workspaceId == "preview-workspace")
    }
    @Test func widgetProjectAndPageActionsReachEveryCardWithoutNetwork() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let engine = SIMPLEngine(store: SharedStore(directory: directory), sessions: MemorySessionStore(), preview: true)
        _ = try await engine.preview()
        var result = try await engine.navigateWidget(projectDirection: 1)
        #expect(result.preferences.projectId == "preview-project")
        result = try await engine.navigateWidget(pageDirection: 1, pageSize: 2)
        #expect(result.snapshot.widgetCards(preferences: result.preferences, pageSize: 2).page == 1)
        result = try await engine.navigateWidget(section: .done)
        #expect(result.preferences.widgetPage == 0)
        #expect(result.snapshot.visibleCards(result.preferences.widgetSection, preferences: result.preferences).count == 1)
        result = try await engine.navigateWidget(projectDirection: 1)
        #expect(result.preferences.projectId == nil)
        result = try await engine.navigateWidget(toggleScope: true)
        #expect(result.preferences.onlyMyCards)
    }

    @Test func expandingWorkspaceAccessBaselinesHistoryButDeliversSubsequentEvents() {
        var snapshot = PreviewData.snapshot()
        var prefs = UserPreferences(); prefs.notificationsEnabled = true
        _ = AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs)
        snapshot.workspaces.append(Workspace(id: "added", name: "Added"))
        snapshot.activities.append(Activity(id: "historical", recipientId: "preview-user", actorId: "colleague", workspaceId: "added", cardId: "c", eventType: "comment.created", subject: "Old thread", createdAt: Date().addingTimeInterval(-86400)))
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
        snapshot.activities.append(Activity(id: "new-event", recipientId: "preview-user", actorId: "colleague", workspaceId: "added", cardId: "c", eventType: "comment.created", subject: "New comment", createdAt: Date()))
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).map(\.id) == ["new-event"])
    }

    @Test func sharedReadStatusRemainsReadUntilItsMarkIsRemoved() {
        var snapshot = PreviewData.snapshot()
        let card = snapshot.cards[2]
        let prefs = UserPreferences()
        snapshot.cards[2].reviewedAt = Date(); snapshot.cards[2].reviewedBy = "preview-user"
        snapshot.activities.append(Activity(id: "new-comment", recipientId: "preview-user", actorId: "colleague", workspaceId: card.workspaceId, cardId: card.id, eventType: "comment.created", subject: card.title, createdAt: Date()))
        #expect(!snapshot.visibleCards(.new, preferences: prefs).contains { $0.id == card.id })
        snapshot.cards[2].reviewedAt = nil; snapshot.cards[2].reviewedBy = nil
        #expect(snapshot.visibleCards(.new, preferences: prefs).contains { $0.id == card.id })
        #expect(snapshot.section(of: snapshot.cards[2]) == .work)
    }

    @Test func projectFilterRetainsWorkAndDoneCardsAndPagesReachEveryCard() {
        var snapshot = PreviewData.snapshot()
        snapshot.columns.append(BoardColumn(id: "another-project", workspaceId: "preview-workspace", name: "Launch", kind: .project))
        var other = snapshot.cards[0]; other.id = "another-card"; other.projectId = "another-project"
        snapshot.cards.append(other)
        var prefs = UserPreferences(); prefs.projectId = "preview-project"
        #expect(snapshot.visibleCards(.all, preferences: prefs).count == 4)
        #expect(snapshot.visibleCards(.work, preferences: prefs).count == 1)
        #expect(snapshot.visibleCards(.done, preferences: prefs).count == 1)
        let first = snapshot.widgetCards(preferences: prefs, pageSize: 2)
        prefs.widgetPage = 1
        let second = snapshot.widgetCards(preferences: prefs, pageSize: 2)
        #expect(Set((first.cards + second.cards).map(\.id)) == Set(snapshot.cards.prefix(4).map(\.id)))
        prefs.widgetPage = 500
        #expect(snapshot.widgetCards(preferences: prefs, pageSize: 2).page == 1)
    }
    @Test func notificationsCoverOtherWorkspacesAndArchivesWithoutCardsDespiteViewFilters() {
        var snapshot = PreviewData.snapshot()
        snapshot.workspaces.append(Workspace(id: "other-workspace", name: "Launch"))
        var prefs = UserPreferences(); prefs.notificationsEnabled = true; prefs.filterLabelIds = ["not-visible"]
        _ = AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs)
        snapshot.activities = ["card.created", "comment.created", "card.archived", "card.completed"].enumerated().map { index, type in
            Activity(id: "event-\(index)", recipientId: "preview-user", actorId: "other", workspaceId: "other-workspace", cardId: "archived-card", eventType: type, subject: "Outside the selected project", createdAt: Date())
        }
        let alerts = AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs)
        #expect(alerts.count == 3)
        #expect(alerts.allSatisfy { $0.workspaceId == "other-workspace" && $0.body == "Outside the selected project" })
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
        snapshot.workspaces.removeLast()
        snapshot.activities.append(Activity(id: "revoked", recipientId: "preview-user", actorId: "other", workspaceId: "other-workspace", cardId: "c", eventType: "card.created", subject: "Private", createdAt: Date()))
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
    }
    @Test func approvalBaselineUpgradeAndLabelTransitionsDoNotReplayOrRepeat() {
        var snapshot = PreviewData.snapshot()
        snapshot.labels.append(TaskLabel(id: "approved", workspaceId: "preview-workspace", name: "Freigegeben"))
        snapshot.cards[0].labelIds.append("approved")
        var prefs = UserPreferences(); prefs.notificationsEnabled = true; prefs.notificationBaselineEstablished = true
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
        snapshot.cards[1].labelIds.append("approved")
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).map(\.cardId) == ["preview-2"])
        snapshot.cards[1].updatedAt = Date()
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
        snapshot.cards[1].labelIds.removeAll { $0 == "approved" }
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).isEmpty)
        snapshot.cards[1].labelIds.append("approved")
        #expect(AlertPolicy.evaluate(snapshot: snapshot, preferences: &prefs).count == 1)
    }
    @Test func perCardReadUsesDisplayedVersionAndDoesNotHideNewerChanges() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        let engine = SIMPLEngine(store: store, sessions: MemorySessionStore(), preview: true)
        let original = try await engine.preview()
        let shown = original.snapshot.cards[0]
        var newer = original.snapshot; newer.cards[0].updatedAt = shown.updatedAt.addingTimeInterval(60)
        try store.save(newer)
        await #expect(throws: SIMPLError.confirmationMissing) { try await engine.markCardRead(shown.id, through: shown.updatedAt) }
        var result = await engine.cached()
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).count == 4)
        result = try await engine.markCardRead(shown.id)
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).count == 3)
        var stale = original.preferences; stale.textScale = .large
        result = try await engine.updatePreferences(stale)
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).count == 3)
    }
    @Test func inboxAcknowledgementCoversOtherProjectsAndSurvivesRelaunch() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = SharedStore(directory: directory)
        let engine = SIMPLEngine(store: store, sessions: MemorySessionStore(), preview: true)
        var result = try await engine.preview()
        var snapshot = result.snapshot; snapshot.cards[1].projectId = "second-project"
        try store.save(snapshot)
        result.preferences.projectId = "preview-project"
        _ = try await engine.updatePreferences(result.preferences)
        result = try await engine.markViewed()
        result.preferences.projectId = nil
        result = try await engine.updatePreferences(result.preferences)
        #expect(result.snapshot.visibleCards(.new, preferences: result.preferences).isEmpty)
        let relaunched = SIMPLEngine(store: store, sessions: MemorySessionStore(), preview: true)
        let cached = await relaunched.cached()
        #expect(cached.snapshot.visibleCards(.new, preferences: cached.preferences).isEmpty)
    }
}
