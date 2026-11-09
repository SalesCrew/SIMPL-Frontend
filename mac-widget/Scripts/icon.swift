import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Original vector artwork, rendered at every macOS icon resolution.
// No SF Symbol artwork or fonts are embedded in the app icon.
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let colorSpace = CGColorSpaceCreateDeviceRGB()
for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = points * scale
        let context = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8,
            bytesPerRow: 0, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.scaleBy(x: CGFloat(pixels) / 1024, y: CGFloat(pixels) / 1024)
        let shape = CGPath(roundedRect: CGRect(x: 64, y: 64, width: 896, height: 896),
                           cornerWidth: 195, cornerHeight: 195, transform: nil)
        context.saveGState()
        context.addPath(shape); context.clip()
        let gradient = CGGradient(colorsSpace: colorSpace, colors: [
            CGColor(red: 0.11, green: 0.66, blue: 0.39, alpha: 1),
            CGColor(red: 0.08, green: 0.45, blue: 0.27, alpha: 1),
        ] as CFArray, locations: [0, 1])!
        context.drawLinearGradient(gradient, start: CGPoint(x: 300, y: 960), end: CGPoint(x: 700, y: 64),
                                   options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
        context.restoreGState()
        context.setStrokeColor(CGColor(gray: 1, alpha: 1))
        context.setLineWidth(38); context.setLineCap(.round); context.setLineJoin(.round)
        context.move(to: CGPoint(x: 230, y: 701))
        context.addLine(to: CGPoint(x: 280, y: 651))
        context.addLine(to: CGPoint(x: 366, y: 749))
        context.strokePath()
        for y: CGFloat in [700, 500, 300] {
            context.move(to: CGPoint(x: 454, y: y))
            context.addLine(to: CGPoint(x: 768, y: y))
            context.strokePath()
        }
        context.setLineWidth(26)
        for y: CGFloat in [500, 300] {
            context.strokeEllipse(in: CGRect(x: 246, y: y - 42, width: 84, height: 84))
        }
        let image = context.makeImage()!
        let name = "icon_\(points)x\(points)\(scale == 2 ? "@2x" : "").png"
        let output = directory.appendingPathComponent(name)
        let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { fatalError("Could not write app icon") }
    }
}
