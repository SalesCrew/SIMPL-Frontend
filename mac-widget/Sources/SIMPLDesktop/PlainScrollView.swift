import SwiftUI
import AppKit

/// An owned AppKit scroll view keeps its scrollers disabled even when macOS
/// is configured to show them always. It still accepts wheel/trackpad input.
struct PlainScrollView<Content: View>: NSViewRepresentable {
    @EnvironmentObject private var model: AppModel
    let bottomRequest: UUID?
    let content: Content
    init(bottomRequest: UUID? = nil, @ViewBuilder content: () -> Content) {
        self.bottomRequest = bottomRequest; self.content = content()
    }
    func makeNSView(context: Context) -> HostingScrollView { HostingScrollView() }
    func updateNSView(_ scroll: HostingScrollView, context: Context) {
        scroll.host.rootView = AnyView(content.environmentObject(model).tint(.green)
            .environment(\.simplTextScale, model.preferences.textScale.multiplier)
            .fixedSize(horizontal: false, vertical: true))
        scroll.needsLayout = true
        if scroll.request != bottomRequest {
            let initial = scroll.request == nil
            scroll.request = bottomRequest
            if !initial { DispatchQueue.main.async { scroll.layoutSubtreeIfNeeded(); scroll.scrollToBottom() } }
        }
    }
    final class HostingScrollView: NSScrollView {
        let host = NSHostingController(rootView: AnyView(EmptyView()))
        var request: UUID?
        override init(frame frameRect: NSRect) {
            super.init(frame: frameRect)
            hasVerticalScroller = false; hasHorizontalScroller = false
            drawsBackground = false; borderType = .noBorder
            verticalScrollElasticity = .automatic; horizontalScrollElasticity = .none
            automaticallyAdjustsContentInsets = false
            host.sizingOptions = []
            documentView = host.view
        }
        required init?(coder: NSCoder) { nil }
        override func layout() {
            super.layout()
            let width = max(1, contentSize.width)
            let size = host.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude))
            let frame = NSRect(x: 0, y: 0, width: width, height: max(0, ceil(size.height)))
            if host.view.frame != frame { host.view.frame = frame }
        }
        func scrollToBottom() {
            let origin = NSPoint(x: 0, y: max(0, host.view.frame.height - contentView.bounds.height))
            if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion { contentView.scroll(to: origin) }
            else { NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.22
                contentView.animator().setBoundsOrigin(origin)
            } }
            reflectScrolledClipView(contentView)
        }
    }
}
