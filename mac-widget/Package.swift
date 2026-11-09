// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SIMPLMac",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "SIMPLCore", targets: ["SIMPLCore"]),
        .library(name: "SIMPLShared", targets: ["SIMPLShared"]),
        .executable(name: "SIMPLDesktop", targets: ["SIMPLDesktop"]),
        .executable(name: "SIMPLWidgetExtension", targets: ["SIMPLWidgetExtension"]),
    ],
    targets: [
        .target(name: "SIMPLCore"),
        .target(name: "SIMPLShared", dependencies: ["SIMPLCore"]),
        .executableTarget(name: "SIMPLDesktop", dependencies: ["SIMPLCore", "SIMPLShared"]),
        .executableTarget(name: "SIMPLWidgetExtension", dependencies: ["SIMPLCore", "SIMPLShared"]),
        .testTarget(name: "SIMPLCoreTests", dependencies: ["SIMPLCore"]),
    ]
)
