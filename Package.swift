// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "WysiwygKit",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [.library(name: "WysiwygKit", targets: ["WysiwygKit"])],
    targets: [
        .target(name: "WysiwygKit", path: "packages/swift/Sources/WysiwygKit", resources: [.copy("Resources/editor")]),
        .testTarget(name: "WysiwygKitTests", dependencies: ["WysiwygKit"], path: "packages/swift/Tests/WysiwygKitTests")
    ]
)
