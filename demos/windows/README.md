# Windows WPF demo

Requires a Windows desktop, .NET 8 SDK and the Microsoft Edge WebView2 Runtime.

```powershell
dotnet run --project demos/windows
```

The library includes the offline engine as embedded resources. It extracts only its own resources into a temporary directory and maps them to a controlled virtual HTTPS origin. It blocks top-level navigation/new windows and rejects messages from another source.

The demo selects formats, theme, UI locale and read-only mode and exports source/metadata snapshots. The shared palette contains the full command catalog, including image description/focus and table operations. Local image insertion uses WebView2's platform picker and bounded data URI storage.

Set `UploadImage` and `ResolveAsset` delegates before the control's Loaded event to use native networking and your own asset service. Keep storage/signing credentials in the host. All public view methods run on the WPF Dispatcher thread; dispose the control at the end of its editing session.

```powershell
dotnet run --project tests/windows
```

This smoke application exercises a real WebView2. A cross-build on macOS only validates compilation. Narrator, Windows IME, minimum-version and interactive visual QA remain manual checks.
