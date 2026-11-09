import SwiftUI
#if SWIFT_PACKAGE
import SIMPLCore
#endif

public enum SIMPLStyle {
    public static func color(_ name: String) -> Color {
        switch name {
        case "red", "rose": .red
        case "orange", "amber": .orange
        case "yellow", "lime": .yellow
        case "blue", "sky", "indigo": .blue
        case "purple", "violet", "fuchsia": .purple
        case "pink": .pink
        case "teal", "cyan": .teal
        case "gray", "slate": .gray
        default: .green
        }
    }
}
public struct LabelChip: View {
    let label: TaskLabel
    let compact: Bool
    public init(_ label: TaskLabel, compact: Bool = false) { self.label = label; self.compact = compact }
    public var body: some View {
        HStack(spacing: compact ? 3 : 4) {
            Circle().fill(SIMPLStyle.color(label.color)).frame(width: compact ? 4 : 5, height: compact ? 4 : 5)
            Text(label.name).lineLimit(1)
        }
        .simplFont(compact ? .caption : .caption2).foregroundStyle(.secondary)
        .padding(.horizontal, compact ? 5 : 6).padding(.vertical, compact ? 1 : 3)
        .background(.quaternary, in: Capsule())
        .accessibilityLabel("Label: \(label.name)")
        .help(label.name)
    }
}

public struct TaskListMetadata: View {
    let card: TaskCard
    let snapshot: TaskSnapshot
    let showWorkspace: Bool
    public init(card: TaskCard, snapshot: TaskSnapshot, showWorkspace: Bool = false) {
        self.card = card; self.snapshot = snapshot; self.showWorkspace = showWorkspace
    }
    public var body: some View {
        TaskMetadataFlow(spacing: 5) {
            ForEach(snapshot.labels(for: card)) { LabelChip($0, compact: true) }
            HStack(spacing: 4) {
                Text(snapshot.section(of: card) == .new ? "Offen" : snapshot.section(of: card).title)
                    .foregroundStyle(.secondary).fixedSize()
                if let project = snapshot.projectName(for: card) {
                    Text("· \(project)").foregroundStyle(.tertiary).lineLimit(1)
                }
            }.simplFont(.caption)
            if showWorkspace {
                Text("· \(snapshot.workspaceName(for: card))")
                    .simplFont(.caption).foregroundStyle(.tertiary).lineLimit(1)
            }
        }.accessibilityElement(children: .combine)
    }
}

// Preserve label → status → original project order when a narrow pane needs a second line.
private struct TaskMetadataFlow: Layout {
    let spacing: CGFloat
    private struct Item { let index: Int; let size: CGSize }
    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, points: [CGPoint], sizes: [CGSize]) {
        var rows: [[Item]] = [[]]
        var rowWidth: CGFloat = 0
        for (index, subview) in subviews.enumerated() {
            var size = subview.sizeThatFits(.unspecified)
            if size.width > width { size = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)) }
            if rowWidth > 0 && rowWidth + spacing + size.width > width {
                rows.append([]); rowWidth = 0
            }
            rows[rows.count - 1].append(Item(index: index, size: size))
            rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
        }
        var points = Array(repeating: CGPoint.zero, count: subviews.count)
        var sizes = Array(repeating: CGSize.zero, count: subviews.count)
        var maxWidth: CGFloat = 0
        var y: CGFloat = 0
        for row in rows where !row.isEmpty {
            let height = row.map(\.size.height).max() ?? 0
            var x: CGFloat = 0
            for item in row {
                points[item.index] = CGPoint(x: x, y: y + (height - item.size.height) / 2)
                sizes[item.index] = item.size
                x += item.size.width + spacing
            }
            maxWidth = max(maxWidth, x - spacing)
            y += height + spacing
        }
        return (CGSize(width: maxWidth, height: max(0, y - spacing)), points, sizes)
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: max(0, proposal.width ?? .infinity), subviews: subviews).size
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(width: bounds.width, subviews: subviews)
        for index in subviews.indices {
            subviews[index].place(at: CGPoint(x: bounds.minX + result.points[index].x, y: bounds.minY + result.points[index].y),
                                 anchor: .topLeading, proposal: ProposedViewSize(result.sizes[index]))
        }
    }
}
public struct TaskText: View {
    let card: TaskCard
    let snapshot: TaskSnapshot
    let compact: Bool
    let labelLimit: Int
    public init(card: TaskCard, snapshot: TaskSnapshot, compact: Bool = false, labelLimit: Int? = nil) {
        self.card = card; self.snapshot = snapshot; self.compact = compact
        self.labelLimit = labelLimit ?? (compact ? 2 : 3)
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: compact ? 4 : 6) {
            Text(card.title).simplFont(compact ? .subheadline : .body).fontWeight(.medium)
                .lineLimit(compact ? 2 : 3)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 5) {
                ForEach(snapshot.labels(for: card).prefix(labelLimit)) { LabelChip($0) }
                if !compact, let project = snapshot.projectName(for: card) {
                    Text(project).simplFont(.caption).foregroundStyle(.tertiary).lineLimit(1)
                }
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
