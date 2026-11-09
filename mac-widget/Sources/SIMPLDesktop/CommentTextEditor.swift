import SwiftUI
import AppKit

struct CommentTextEditor: NSViewRepresentable {
    @Environment(\.isEnabled) private var isEnabled
    @Binding var text: String
    @Binding var height: CGFloat
    let fontScale: Double
    var onFiles: ([URL]) -> Void
    var onImage: (Data) -> Void
    var onFailure: (String) -> Void
    var onSend: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = false; scroll.hasHorizontalScroller = false
        scroll.drawsBackground = false; scroll.borderType = .noBorder
        let editor = ComposerTextView()
        editor.isRichText = false; editor.allowsUndo = true; editor.drawsBackground = false
        editor.isVerticallyResizable = true; editor.isHorizontallyResizable = false
        editor.autoresizingMask = [.width]
        editor.textContainer?.widthTracksTextView = true
        editor.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        editor.textContainerInset = NSSize(width: 4, height: 6)
        editor.textContainer?.lineFragmentPadding = 0
        editor.textColor = .labelColor; editor.insertionPointColor = .controlAccentColor
        editor.font = .systemFont(ofSize: 13 * fontScale)
        editor.setAccessibilityLabel("Kommentar schreiben")
        editor.registerForDraggedTypes([.fileURL, .png, .tiff, .string])
        editor.delegate = context.coordinator
        editor.onFiles = onFiles; editor.onImage = onImage; editor.onFailure = onFailure
        editor.onSend = onSend
        scroll.documentView = editor
        return scroll
    }
    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let editor = scroll.documentView as? ComposerTextView else { return }
        editor.onFiles = onFiles; editor.onImage = onImage; editor.onFailure = onFailure
        editor.onSend = onSend
        editor.font = .systemFont(ofSize: 13 * fontScale)
        editor.isEditable = isEnabled
        if editor.string != text { editor.string = text }
        context.coordinator.measure(editor)
    }
    @MainActor final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: CommentTextEditor
        init(_ parent: CommentTextEditor) { self.parent = parent }
        func textDidChange(_ notification: Notification) {
            guard let editor = notification.object as? NSTextView else { return }
            parent.text = editor.string; measure(editor)
        }
        func measure(_ editor: NSTextView) {
            guard let container = editor.textContainer, let layout = editor.layoutManager else { return }
            layout.ensureLayout(for: container)
            let next = min(132, max(44, ceil(layout.usedRect(for: container).height + 14)))
            if abs(parent.height - next) > 0.5 {
                DispatchQueue.main.async { [weak self] in self?.parent.height = next }
            }
        }
    }
    final class ComposerTextView: NSTextView {
        var onFiles: (([URL]) -> Void)?
        var onImage: ((Data) -> Void)?
        var onFailure: ((String) -> Void)?
        var onSend: (() -> Void)?
        override func keyDown(with event: NSEvent) {
            // Let input methods commit their marked text before submitting.
            if isEditable, !hasMarkedText(), (event.keyCode == 36 || event.keyCode == 76),
               event.modifierFlags.intersection([.shift, .option, .control]).isEmpty {
                if !event.isARepeat { onSend?() }; return
            }
            super.keyDown(with: event)
        }
        override func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
            if menuItem.action == #selector(paste(_:)), isEditable {
                let board = NSPasteboard.general
                if board.canReadObject(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true])
                    || NSImage.canInit(with: board) { return true }
            }
            return super.validateMenuItem(menuItem)
        }
        override func paste(_ sender: Any?) {
            if !handle(NSPasteboard.general) { super.paste(sender) }
        }
        override func draggingEntered(_ sender: any NSDraggingInfo) -> NSDragOperation {
            let board = sender.draggingPasteboard
            if isEditable && (board.canReadObject(forClasses:[NSURL.self],options:[.urlReadingFileURLsOnly:true]) || NSImage.canInit(with:board)) { return .copy }
            return super.draggingEntered(sender)
        }
        override func performDragOperation(_ sender: any NSDraggingInfo) -> Bool {
            if isEditable && handle(sender.draggingPasteboard) { return true }
            return super.performDragOperation(sender)
        }
        private func handle(_ board:NSPasteboard) -> Bool {
            if let files = board.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !files.isEmpty {
                onFiles?(files); return true
            }
            if let image = NSImage(pasteboard: board) {
                guard !image.representations.contains(where:{ Int64($0.pixelsWide) * Int64($0.pixelsHigh) > 25_000_000 }) else {
                    onFailure?("Dieses Bild ist zu groß zum Einfügen. Bitte hänge die Originaldatei an."); return true
                }
                if let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data:tiff), let png = bitmap.representation(using:.png,properties:[:]) { onImage?(png); return true }
            }
            return false
        }
    }
}
