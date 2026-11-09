import SwiftUI
import UniformTypeIdentifiers
import ImageIO
#if SWIFT_PACKAGE
import SIMPLCore
import SIMPLShared
#endif

struct AttachmentGroup: View {
    let items: [TaskAttachment]
    @State private var filter = 0
    private var visible: [TaskAttachment] { items.filter { filter == 0 || (filter == 1 ? $0.isImage : !$0.isImage) } }
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            if items.count > 1 {
                Picker("Anhänge", selection:$filter) {
                    Text("Alle \(items.count)").tag(0)
                    Text("Bilder \(items.filter(\.isImage).count)").tag(1)
                    Text("Dateien \(items.filter { !$0.isImage }.count)").tag(2)
                }.pickerStyle(.segmented).labelsHidden().controlSize(.mini)
            }
            ForEach(visible.sorted { $0.isImage && !$1.isImage }) { AttachmentTile(item:$0) }
        }
    }
}

struct AttachmentTile: View {
    @EnvironmentObject private var model: AppModel
    let item: TaskAttachment
    @State private var thumbnail: NSImage?
    @State private var loading = false
    @State private var error: String?
    @State private var copied = false
    @State private var actionBusy = false
    private var symbol: String {
        let type = UTType(filenameExtension:(item.filename as NSString).pathExtension)
        if type?.conforms(to:.movie) == true { return "film" }
        if type?.conforms(to:.audio) == true { return "waveform" }
        if type?.conforms(to:.archive) == true { return "archivebox" }
        if type?.conforms(to:.pdf) == true { return "doc.richtext" }
        if type?.conforms(to:.image) == true { return "photo" }
        return "doc"
    }
    var body: some View {
        VStack(spacing:0) {
            if item.isImage {
                Button { Task { await model.previewAttachment(item) } } label: {
                    ZStack {
                        Color.primary.opacity(0.025)
                        if let thumbnail { Image(nsImage:thumbnail).resizable().scaledToFit().padding(6) }
                        else if loading { ProgressView().controlSize(.small) }
                        else { Image(systemName:"photo").foregroundStyle(.tertiary) }
                    }.frame(height:130).frame(maxWidth:.infinity).contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityLabel("\(item.filename) ansehen")
            }
            HStack(spacing:10) {
                if !item.isImage { Image(systemName:symbol).font(.system(size:21,weight:.light)).foregroundStyle(.secondary).frame(width:28) }
                Button { Task { await model.previewAttachment(item) } } label: {
                    VStack(alignment:.leading,spacing:3) {
                        Text(item.filename).simplFont(.caption).fontWeight(.medium).lineLimit(1).truncationMode(.middle)
                        Text(ByteCountFormatter.string(fromByteCount:item.sizeBytes,countStyle:.file)).simplFont(.caption2).foregroundStyle(.tertiary)
                    }.frame(maxWidth:.infinity,alignment:.leading).contentShape(Rectangle())
                }.buttonStyle(.plain).help("In der Schnellvorschau ansehen")
                Group {
                    Button {
                        Task { actionBusy = true; await model.copyAttachment(item); actionBusy = false
                            if model.fileError == nil { copied = true; try? await Task.sleep(for:.seconds(2)); copied = false }
                        }
                    } label: { Image(systemName:copied ? "checkmark" : "doc.on.doc").foregroundStyle(copied ? Color.accentColor : .secondary) }
                        .buttonStyle(.plain).disabled(actionBusy).help(item.isImage ? "Bild kopieren" : "Datei kopieren").accessibilityLabel("\(item.filename) kopieren")
                }
                Button { Task { actionBusy = true; await model.saveAttachment(item); actionBusy = false } } label: { Image(systemName:"arrow.down.to.line").foregroundStyle(.secondary) }
                    .buttonStyle(.plain).disabled(actionBusy).help("Originaldatei sichern").accessibilityLabel("\(item.filename) sichern")
                if actionBusy { ProgressView().controlSize(.mini) }
            }.padding(10)
            if let error {
                HStack { Text(error).simplFont(.caption2); Spacer(); Button("Erneut laden") { Task { await loadImage() } }.buttonStyle(.link) }.foregroundStyle(.secondary).padding(10)
            }
        }.background(Color.primary.opacity(0.025),in:RoundedRectangle(cornerRadius:10))
            .clipShape(RoundedRectangle(cornerRadius:10))
            .overlay(RoundedRectangle(cornerRadius:10).strokeBorder(Color.primary.opacity(0.065),lineWidth:1))
            .task(id:item.id) { if item.isImage { await loadImage() } }
    }
    private func loadImage() async {
        loading = true; defer { loading = false }
        do {
            let url = try await model.attachmentURL(item)
            let data = try await Task.detached(priority:.utility) {
                guard let source = CGImageSourceCreateWithURL(url as CFURL,nil), let cg = CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true, kCGImageSourceThumbnailMaxPixelSize:900, kCGImageSourceCreateThumbnailWithTransform:true] as CFDictionary) else { throw SIMPLError.invalidFile }
                let bitmap = NSBitmapImageRep(cgImage:cg)
                guard let png = bitmap.representation(using:.png,properties:[:]) else { throw SIMPLError.invalidFile }
                return png
            }.value
            thumbnail = NSImage(data:data); error = nil
        } catch { self.error = error.localizedDescription }
    }
}
