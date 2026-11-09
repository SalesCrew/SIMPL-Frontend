import SwiftUI
#if SWIFT_PACKAGE
import SIMPLCore
#endif

struct CopyToCodexButton: View {
    @EnvironmentObject private var model: AppModel
    let cardId: String
    @State private var copying = false
    @State private var copied = false
    @State private var copyError: String?
    @State private var copyTask: Task<Void, Never>?
    var body: some View {
        Button {
            copyTask?.cancel()
            copying = true; copied = false
            copyTask = Task { @MainActor in
                defer { copying = false }
                do {
                    let source = try await model.engine.feedback(cardId: cardId)
                    var files: [URL] = []
                    for file in source.orderedAttachments {
                        try Task.checkCancellation()
                        files.append(try await model.attachmentURL(file))
                    }
                    let feedbackDocument = try await model.engine.finishFeedback(source)
                    if let feedbackDocument { files.append(feedbackDocument) }
                    try Task.checkCancellation()
                    guard model.selectedCardId == cardId else { return }
                    try TaskClipboard.write(text: feedbackDocument == nil ? source.text() : TaskClipboard.codexPrompt, files: files)
                    copied = true
                    try await Task.sleep(for: .seconds(2))
                    copied = false
                } catch is CancellationError { copied = false }
                catch {
                    if (error as? SIMPLError)?.clearsPrivateData == true { model.accept(await model.engine.cached()) }
                    if !Task.isCancelled { copyError = error.localizedDescription }
                }
            }
        } label: {
            HStack(spacing: 5) {
                ZStack {
                    Image(systemName: copied ? "checkmark" : "doc.on.clipboard").opacity(copying && !copied ? 0 : 1)
                    if copying && !copied { ProgressView().controlSize(.mini) }
                }.frame(width: 14, height: 14)
                Text("Copy to Codex")
            }.simplFont(.caption)
        }
        .buttonStyle(.bordered).controlSize(.small).disabled(copying)
        .help(copied ? "Kopiert — mit ⌘V in Codex einfügen" : "Name, Beschreibung, Checklisten, Kommentare und alle Anhänge kopieren")
        .accessibilityLabel(copied ? "Copy to Codex — kopiert" : "Copy to Codex")
        .onDisappear { copyTask?.cancel() }
        .alert("Kopieren fehlgeschlagen", isPresented: Binding(get: { copyError != nil }, set: { if !$0 { copyError = nil } })) {
            Button("OK") { copyError = nil }
        } message: { Text(copyError ?? "") }
    }
}
