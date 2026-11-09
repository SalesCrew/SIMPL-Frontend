import SwiftUI
import AppKit

private struct TextScaleKey: EnvironmentKey { static let defaultValue: Double = 1 }
extension EnvironmentValues {
    public var simplTextScale: Double {
        get { self[TextScaleKey.self] }
        set { self[TextScaleKey.self] = newValue }
    }
}
private struct PreferredFont: ViewModifier {
    let style: Font.TextStyle
    @Environment(\.simplTextScale) private var scale
    @ViewBuilder
    func body(content: Content) -> some View {
        if scale <= 1 {
            // Preserve the native text style so the real widget host can apply
            // any supported system typography behavior.
            content.font(.system(style))
        } else {
            let base = NSFont.preferredFont(forTextStyle: appKitStyle, options: [:])
            let font = NSFont(descriptor: base.fontDescriptor, size: base.pointSize * min(scale, 1.4)) ?? base
            content.font(Font(font))
        }
    }
    private var appKitStyle: NSFont.TextStyle {
        switch style {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .subheadline: .subheadline
        case .callout: .callout
        case .footnote: .footnote
        case .caption: .caption1
        case .caption2: .caption2
        default: .body
        }
    }
}
extension View {
    public func simplFont(_ style: Font.TextStyle) -> some View { modifier(PreferredFont(style: style)) }
}
