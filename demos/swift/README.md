# Apple demos

## macOS

From a checkout containing the bundled engine:

```sh
swift run --package-path demos/swift
```

The SwiftUI demo loads all formats and offers theme, UI locale, read-only mode and snapshot export. Command menus expose common editing commands; the shared Command-K palette exposes the complete catalog. The embedded image picker uses the platform file panel and bounded local data storage.

## iOS/iPadOS

Open `iOS/WysiwygDemo.xcodeproj` in Xcode and choose an iPhone/iPad simulator. The project references the local root Swift package. Select your own development team and bundle identifier before running on a physical device. The example identifier is only a demo boundary, not a provisioned app identity.

```sh
xcodebuild -quiet -project demos/swift/iOS/WysiwygDemo.xcodeproj \
  -scheme WysiwygDemo -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/editor-ios-build CODE_SIGNING_ALLOWED=NO build
```

Deployment targets are macOS 13 and iOS/iPadOS 16. A current SDK build is not verification of those minimum OS versions or an actual touch/IME/accessibility run.

## Host integration

Create an `EditorController`, mount `EditorView`, then use the async load/snapshot/command/configure methods. They wait for readiness and report bridge failures/timeouts. Dispose when the owning editing session ends. Set `uploadImage` and `resolveAsset` delegates before mounting to use native networking and host-managed storage; otherwise the demo uses local data URIs. Secrets stay in the host, never in JavaScript arguments. Asset delegates receive data from a platform picker and must validate/authorize it appropriately.

The root test suite includes an actual macOS WKWebView load/edit/export/stale-document regression. Manual minimum-OS, iOS runtime, VoiceOver and IME testing remain separate evidence.
