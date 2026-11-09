import SwiftUI
import Quartz

struct FilePreviewView: View {
    let url: URL
    let close: () -> Void
    var body: some View {
        VStack(spacing:0) {
            HStack {
                Text(url.lastPathComponent).font(.headline).lineLimit(1).truncationMode(.middle)
                Spacer()
                Button("Fertig", action:close).keyboardShortcut(.cancelAction)
            }.padding(16)
            Divider()
            NativeFilePreview(url:url)
        }.frame(minWidth:640,minHeight:480)
    }
}
private struct NativeFilePreview: NSViewRepresentable {
    let url: URL
    func makeNSView(context:Context) -> QLPreviewView { QLPreviewView(frame:.zero,style:.normal)! }
    func updateNSView(_ view:QLPreviewView, context:Context) {
        view.autostarts = false
        view.previewItem = url as NSURL
    }
}
