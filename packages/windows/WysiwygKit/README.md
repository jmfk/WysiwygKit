# WysiwygKit.Wpf

An early-preview WPF control for Markdown, HTML and Fountain. The control embeds the same local editor engine used by the web, React and SwiftUI packages. MIT licensed; WebView2 SDK/runtime retain their own terms.

Requires Windows, .NET 8 and Microsoft Edge WebView2 Runtime.

```csharp
var editor = new WysiwygKit.EditorControl(new(
    Guid.NewGuid().ToString(), WysiwygKit.DocumentFormat.markdown, "# Hello"));
host.Content = editor;
var snapshot = await editor.SnapshotAsync();
// Save source and metadata atomically, then:
await editor.MarkSavedAsync(snapshot);
```

Set upload/resolution delegates before Loaded, use methods on the WPF Dispatcher thread, and dispose at the end of the owning editing session. See the repository's demos, security notes and implementation status before production use.
