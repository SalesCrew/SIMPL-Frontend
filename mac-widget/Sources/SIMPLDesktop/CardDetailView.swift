import SwiftUI
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

struct CardDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let card: TaskCard
    private var state: TaskSection { model.snapshot.section(of: card) }
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(card.archivedAt == nil ? "Karte" : "Archivierte Karte").simplFont(.caption).foregroundStyle(.tertiary)
                Spacer()
                CopyToCodexButton(cardId: card.id).id(card.id).padding(.trailing, 8)
                Button { model.closeCard() } label: { Image(systemName: "xmark").foregroundStyle(.secondary) }
                    .buttonStyle(.plain).help("Details schließen").accessibilityLabel("Details schließen")
            }.padding(.horizontal, 24).padding(.top, 22).padding(.bottom, 14)
            PlainScrollView(bottomRequest: model.commentScrollRequest) {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 12) {
                            if let project = model.snapshot.projectName(for: card) { Label(project, systemImage: "folder").simplFont(.caption).foregroundStyle(.secondary) }
                            Text(card.title).simplFont(.title2).fontWeight(.semibold).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                            HStack(spacing: 8) {
                                Label(state == .new ? "Offen" : state.title, systemImage: state.symbol)
                                    .simplFont(.caption).foregroundStyle(state == .done ? Color.accentColor : .secondary)
                                Spacer()
                                if model.snapshot.isUnread(card, preferences: model.preferences) {
                                    Button("Als gelesen markieren") { Task { await model.markRead(card) } }.buttonStyle(.link).simplFont(.caption)
                                } else { Label("Gelesen", systemImage: "checkmark").simplFont(.caption).foregroundStyle(.tertiary) }
                            }
                            if card.isActive {
                                HStack(spacing: 8) {
                                    if state == .new { Button("In Arbeit", systemImage: "play") { Task { await model.perform(card, start: true) } }.buttonStyle(.bordered) }
                                    Button(state == .done ? "Wieder öffnen" : "Fertig", systemImage: state == .done ? "arrow.uturn.backward" : "checkmark") {
                                        Task { await model.perform(card) }
                                    }.buttonStyle(.bordered).tint(state == .done ? .secondary : .green)
                                }.controlSize(.small).disabled(model.busy)
                            }
                            if !model.snapshot.labels(for: card).isEmpty {
                                ViewThatFits(in: .horizontal) {
                                    HStack(spacing: 5) { ForEach(model.snapshot.labels(for: card)) { LabelChip($0) } }
                                    VStack(alignment: .leading, spacing: 5) { ForEach(model.snapshot.labels(for: card)) { LabelChip($0) } }
                                }
                            }
                        }
                        if let description = card.description, !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Beschreibung").simplFont(.subheadline).fontWeight(.semibold)
                                Text(description).simplFont(.body).foregroundStyle(.secondary).textSelection(.enabled)
                            }
                        }
                        let cardFiles = model.attachments.filter { $0.commentId == nil }
                        if !cardFiles.isEmpty {
                            VStack(alignment:.leading,spacing:10) {
                                Text("Anhänge").simplFont(.subheadline).fontWeight(.semibold)
                                AttachmentGroup(items:cardFiles)
                            }
                        }
                        VStack(alignment: .leading, spacing: 18) {
                            HStack {
                                Text("Kommentare").simplFont(.subheadline).fontWeight(.semibold)
                                Text("\(model.comments.count)").simplFont(.caption).foregroundStyle(.tertiary)
                                Spacer()
                                if model.commentsLoading { ProgressView().controlSize(.mini) }
                                else { Button { Task { await model.loadComments() } } label: { Image(systemName: "arrow.clockwise").foregroundStyle(.tertiary) }.buttonStyle(.plain).accessibilityLabel("Kommentare aktualisieren") }
                            }
                            if model.comments.isEmpty && !model.commentsLoading {
                                Text("Noch keine Kommentare.").simplFont(.callout).foregroundStyle(.tertiary)
                            }
                            ForEach(model.comments) { comment in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(comment.authorId == model.snapshot.profile?.id ? "Du" : comment.authorName).simplFont(.callout).fontWeight(.medium)
                                        Spacer()
                                        Text(comment.createdAt, format: .dateTime.day().month(.abbreviated).hour().minute())
                                            .simplFont(.caption2).foregroundStyle(.tertiary)
                                    }
                                    if !comment.body.isEmpty {
                                        Text(comment.body).simplFont(.callout).foregroundStyle(.secondary).textSelection(.enabled).fixedSize(horizontal:false,vertical:true)
                                    }
                                    let files = model.attachments.filter { $0.commentId == comment.id || (comment.attachmentIds ?? []).contains($0.id) }
                                    if !files.isEmpty { AttachmentGroup(items:files) }
                                }.padding(14).frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 12))
                            }
                            Color.clear.frame(height: 1).id("comments-end")
                        }
                    }.padding(.horizontal, 24).padding(.bottom, 20)
            }
            if let error = model.commentError {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "exclamationmark.circle")
                    Text(error)
                    Spacer(minLength: 0)
                    Button("Erneut laden") { Task { await model.loadComments() } }.buttonStyle(.link)
                }.simplFont(.caption).foregroundStyle(.secondary).padding(.horizontal, 24).padding(.bottom, 12)
            }
            if card.isActive {
                Divider().opacity(0.5)
                CommentComposerView().padding(.horizontal,20).padding(.vertical,14)
            }
        }.background(.background)
            .sheet(isPresented:Binding(get:{ model.previewURL != nil },set:{ if !$0 { model.previewURL = nil } })) {
                if let url = model.previewURL { FilePreviewView(url:url) { model.previewURL = nil } }
            }
            .alert("Datei konnte nicht geöffnet werden", isPresented:Binding(get:{ model.fileError != nil },set:{ if !$0 { model.fileError = nil } })) {
                Button("OK") { model.fileError = nil }
            } message: { Text(model.fileError ?? "") }
    }
}
