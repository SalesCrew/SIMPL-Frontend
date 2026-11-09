import SwiftUI
import UniformTypeIdentifiers
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

struct CommentComposerView: View {
    @EnvironmentObject private var model: AppModel
    @State private var height: CGFloat = 44
    @State private var targeted = false
    var body: some View {
        VStack(alignment:.leading, spacing:8) {
            if !model.commentFiles.isEmpty {
                PlainScrollView {
                    VStack(spacing:5) {
                        ForEach(model.commentFiles) { file in
                            HStack(spacing:8) {
                                Image(systemName:"doc").foregroundStyle(.secondary)
                                Text(file.filename).lineLimit(1).truncationMode(.middle)
                                Spacer(minLength:4)
                                Text(ByteCountFormatter.string(fromByteCount:file.size, countStyle:.file)).foregroundStyle(.tertiary)
                                Button { model.removeFile(file) } label: { Image(systemName:"xmark").foregroundStyle(.secondary) }
                                    .buttonStyle(.plain).accessibilityLabel("\(file.filename) entfernen")
                            }.simplFont(.caption).padding(8).background(Color.primary.opacity(0.035), in:RoundedRectangle(cornerRadius:8))
                        }
                    }
                }.frame(height:min(140,CGFloat(model.commentFiles.count) * 34))
            }
            ZStack(alignment:.topLeading) {
                CommentTextEditor(text:$model.commentDraft, height:$height, fontScale:model.preferences.textScale.multiplier,
                    onFiles:{ urls in Task { await model.addFiles(urls) } }, onImage:{ data in Task { await model.addPastedImage(data) } }, onFailure:{ model.commentError = $0 },
                    onSend:{ if model.canSendComment { Task { await model.sendComment() } } })
                    .frame(height:height).disabled(model.commentSending || model.filesStaging)
                if model.commentDraft.isEmpty {
                    Text("Dein Kommentar …").simplFont(.callout).foregroundStyle(.tertiary)
                        .padding(.leading,4).padding(.top,7).allowsHitTesting(false)
                }
            }
            HStack(spacing:10) {
                Button { model.chooseFiles() } label: { Image(systemName:"paperclip").simplFont(.body).foregroundStyle(.secondary) }
                    .buttonStyle(.plain).help("Dateien anhängen").accessibilityLabel("Dateien anhängen")
                    .disabled(model.commentSending || model.filesStaging)
                if let status = model.uploadStatus { Text(status).simplFont(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                else if model.commentDraft.utf16.count > 4500 {
                    Text("\(model.commentDraft.utf16.count) / 5.000").simplFont(.caption2).foregroundStyle(model.commentDraft.utf16.count > 5000 ? .red : .secondary)
                } else { Text(model.commentFiles.isEmpty ? "Für dein Team sichtbar" : "\(model.commentFiles.count) / 10 Dateien").simplFont(.caption2).foregroundStyle(.tertiary) }
                Spacer(minLength:0)
                if model.commentSending || model.filesStaging { ProgressView().controlSize(.mini) }
                Button { Task { await model.sendComment() } } label: {
                    Image(systemName:"arrow.up").font(.system(size:12,weight:.semibold)).frame(width:26,height:26)
                        .foregroundStyle(model.canSendComment ? Color.white : Color.secondary)
                        .background(model.canSendComment ? Color.accentColor : Color.primary.opacity(0.05), in:Circle())
                }.buttonStyle(.plain).disabled(!model.canSendComment).accessibilityLabel("Kommentar senden")
                    .keyboardShortcut(.return, modifiers:.command)
            }.padding(.horizontal,4)
        }.padding(12)
            .background(Color.primary.opacity(0.025), in:RoundedRectangle(cornerRadius:14))
            .overlay(RoundedRectangle(cornerRadius:14).strokeBorder(targeted ? Color.accentColor.opacity(0.6) : Color.primary.opacity(0.08), lineWidth:1))
            .onDrop(of:[UTType.fileURL.identifier,UTType.png.identifier,UTType.jpeg.identifier], isTargeted:$targeted) { providers in
                guard !model.commentSending, !model.filesStaging else { return false }
                Task {
                    var urls: [URL] = []
                    for provider in providers {
                        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                            let data:Data? = await withCheckedContinuation { continuation in provider.loadDataRepresentation(forTypeIdentifier:UTType.fileURL.identifier) { data,_ in continuation.resume(returning:data) } }
                            if let data, let url = URL(dataRepresentation:data, relativeTo:nil) { urls.append(url) }
                        } else {
                            let type = provider.hasItemConformingToTypeIdentifier(UTType.png.identifier) ? UTType.png : UTType.jpeg
                            let data:Data? = await withCheckedContinuation { continuation in provider.loadDataRepresentation(forTypeIdentifier:type.identifier) { data,_ in continuation.resume(returning:data) } }
                            if let data { await model.addPastedImage(data) }
                        }
                    }
                    if !urls.isEmpty { await model.addFiles(urls) }
                }
                return true
            }
    }
}
