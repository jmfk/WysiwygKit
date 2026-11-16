// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "WysiwygDemo", platforms: [.macOS(.v13)], dependencies: [.package(name: "WysiwygKit", path: "../..")], targets: [.executableTarget(name: "WysiwygDemo", dependencies: [.product(name: "WysiwygKit", package: "WysiwygKit")])])
