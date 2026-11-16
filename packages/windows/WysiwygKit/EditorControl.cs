using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
namespace WysiwygKit;

/// <summary>A WPF view embedding the locally bundled editor. Use the control on its Dispatcher thread.</summary>
public sealed class EditorControl : UserControl, IDisposable
{
    private const string Origin = "https://editor.invalid/";
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };
    private readonly WebView2 webView = new();
    private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly Dictionary<string, TaskCompletionSource<JsonElement>> pending = [];
    private readonly EditorDocument initial;
    private readonly EditorConfiguration configuration;
    private string? resourceDirectory;
    private bool started, disposed;
    public bool IsReady { get; private set; }
    public EditorState? State { get; private set; }
    public event Action<EditorState>? DocumentChanged;
    public event Action<EditorDiagnostic>? Diagnostic;
    public event Action<Uri>? OpenLink;
    public event Action<Exception>? Failed;
    /// <summary>Assign before Loaded. Null uses bounded local data-URI image storage.</summary>
    public Func<ImageUpload, CancellationToken, Task<EditorAsset>>? UploadImage { get; set; }
    /// <summary>Assign before Loaded. Resolve a durable asset into an authorized temporary presentation URL.</summary>
    public Func<EditorAsset, CancellationToken, Task<string>>? ResolveAsset { get; set; }
    private readonly Dictionary<string, CancellationTokenSource> assetTasks = [];
    public EditorControl() : this(new(Guid.NewGuid().ToString(), DocumentFormat.markdown, "")) { }
    public EditorControl(EditorDocument document, EditorConfiguration? configuration = null)
    {
        initial = document; this.configuration = configuration ?? new(); Content = webView;
        Loaded += async (_, _) => { if (started) return; started = true; try { await StartAsync(); } catch (Exception error) { ready.TrySetException(error); Failed?.Invoke(error); } };
    }
    private async Task StartAsync()
    {
        resourceDirectory = Path.Combine(Path.GetTempPath(), "wysiwyg-editor-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(resourceDirectory);
        foreach (var name in typeof(EditorControl).Assembly.GetManifestResourceNames().Where(n => n.StartsWith("Editor.", StringComparison.Ordinal)))
        {
            using var stream = typeof(EditorControl).Assembly.GetManifestResourceStream(name)!;
            using var output = File.Create(Path.Combine(resourceDirectory, name[7..])); await stream.CopyToAsync(output);
        }
        if (!File.Exists(Path.Combine(resourceDirectory, "index.html"))) throw new EditorException("MISSING_RESOURCES", "Build the shared engine before packaging WPF.");
        if (disposed) return;
        await webView.EnsureCoreWebView2Async();
        if (disposed) return;
        var core = webView.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping("editor.invalid", resourceDirectory, CoreWebView2HostResourceAccessKind.DenyCors);
        core.Settings.AreDevToolsEnabled = false; core.Settings.IsWebMessageEnabled = true;
        core.NewWindowRequested += (_, e) => e.Handled = true;
        core.NavigationStarting += (_, e) => { if (e.Uri != Origin + "index.html") e.Cancel = true; };
        core.WebMessageReceived += OnMessage;
        core.ProcessFailed += (_, _) => { IsReady = false; var error = new EditorException("PROCESS_FAILED", "The editor process stopped. Restore the last host snapshot."); foreach (var request in pending.Values) request.TrySetException(error); pending.Clear(); Failed?.Invoke(error); };
        core.NavigationCompleted += async (_, e) =>
        {
            if (!e.IsSuccess) { var error = new EditorException("NAVIGATION_FAILED", "The bundled editor could not be loaded."); ready.TrySetException(error); Failed?.Invoke(error); return; }
            try { await RequestAsync("initialize", new { document = initial, configuration = new { theme = configuration.Theme, locale = configuration.Locale, readOnly = configuration.ReadOnly, toolbar = configuration.Toolbar, uiDirection = configuration.UiDirection, allowRemoteImages = configuration.AllowRemoteImages, useHostUpload = UploadImage is not null, useHostResolve = ResolveAsset is not null } }); IsReady = true; ready.TrySetResult(); }
            catch (Exception error) { ready.TrySetException(error); Failed?.Invoke(error); }
        };
        core.Navigate(Origin + "index.html");
    }
    private void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (disposed || e.Source != Origin + "index.html") return;
        try
        {
            using var json = JsonDocument.Parse(e.WebMessageAsJson); var root = json.RootElement;
            if (!root.TryGetProperty("protocolVersion", out var protocol) || protocol.GetInt32() != 1 || !root.TryGetProperty("type", out var type)) return;
            switch (type.GetString())
            {
                case "assetRequest": _ = HandleAssetAsync(root.Clone()); break;
                case "assetCancel": if (assetTasks.TryGetValue(root.GetProperty("assetRequestId").GetString()!, out var cancelled)) cancelled.Cancel(); break;
                case "response":
                    if (root.TryGetProperty("id", out var id) && pending.Remove(id.GetString() ?? "", out var request))
                    {
                        if (root.GetProperty("ok").GetBoolean()) request.TrySetResult(root.GetProperty("result").Clone());
                        else { var error = root.GetProperty("error"); request.TrySetException(new EditorException(error.GetProperty("code").GetString()!, error.GetProperty("message").GetString()!)); }
                    } break;
                case "change": State = root.GetProperty("state").Deserialize<EditorState>(Json)!; DocumentChanged?.Invoke(State); break;
                case "diagnostic": Diagnostic?.Invoke(root.GetProperty("diagnostic").Deserialize<EditorDiagnostic>(Json)!); break;
                case "openLink": if (Uri.TryCreate(root.GetProperty("url").GetString(), UriKind.Absolute, out var url) && new[] { "https", "http", "mailto", "tel" }.Contains(url.Scheme)) OpenLink?.Invoke(url); break;
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException) { Diagnostic?.Invoke(new("INVALID_EVENT", "An invalid editor event was rejected.", "warning")); }
    }
    private async Task HandleAssetAsync(JsonElement message)
    {
        var id = message.GetProperty("assetRequestId").GetString()!;
        using var cancellation = new CancellationTokenSource(); assetTasks[id] = cancellation;
        try
        {
            object result = message.GetProperty("kind").GetString() switch
            {
                "upload" when UploadImage is not null => await UploadImage(message.GetProperty("payload").Deserialize<ImageUpload>(Json)!, cancellation.Token),
                "resolve" when ResolveAsset is not null => await ResolveAsset(message.GetProperty("payload").Deserialize<EditorAsset>(Json)!, cancellation.Token),
                _ => throw new EditorException("ASSET_HANDLER_REQUIRED", "The host asset handler is unavailable.")
            };
            if (!disposed && !cancellation.IsCancellationRequested) await RequestAsync("assetResponse", new { assetRequestId = id, result });
        }
        catch (Exception) { if (!disposed && !cancellation.IsCancellationRequested) { try { await RequestAsync("assetResponse", new { assetRequestId = id, error = "The host could not complete the image operation." }); } catch (Exception) { } } }
        finally { assetTasks.Remove(id); }
    }
    private async Task<JsonElement> RequestAsync(string operation, object? payload = null, string? documentId = null, int? revision = null, CancellationToken cancellationToken = default)
    {
        Dispatcher.VerifyAccess(); ObjectDisposedException.ThrowIf(disposed, this);
        var id = Guid.NewGuid().ToString(); var response = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously); pending.Add(id, response);
        try
        {
            // Structured WebView messaging: no document interpolation into JavaScript.
            webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { protocolVersion = 1, id, operation, payload = payload ?? new { }, documentId, revision }, Json));
            return await response.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
        }
        finally { pending.Remove(id); }
    }
    private async Task WaitReadyAsync(CancellationToken token) { ObjectDisposedException.ThrowIf(disposed, this); await ready.Task.WaitAsync(TimeSpan.FromSeconds(20), token); }
    public async Task<EditorSnapshot> SnapshotAsync(CancellationToken token = default) { await WaitReadyAsync(token); return (await RequestAsync("snapshot", cancellationToken: token)).Deserialize<EditorSnapshot>(Json)!; }
    public async Task LoadAsync(EditorDocument document, bool acceptNormalization = false, CancellationToken token = default) { await WaitReadyAsync(token); await RequestAsync("load", new { document, acceptNormalization }, cancellationToken: token); }
    public async Task ConfigureAsync(EditorConfiguration configuration, CancellationToken token = default) { await WaitReadyAsync(token); await RequestAsync("configure", configuration, cancellationToken: token); }
    public async Task<bool> CommandAsync(EditorCommand command, object? argument = null, string? documentId = null, int? revision = null, CancellationToken token = default) { await WaitReadyAsync(token); return (await RequestAsync("command", new { command = command.ToString(), argument }, documentId, revision, token)).GetBoolean(); }
    public async Task MarkSavedAsync(EditorSnapshot snapshot, CancellationToken token = default) { await WaitReadyAsync(token); await RequestAsync("markSaved", new { documentId = snapshot.Id, revision = snapshot.Revision }, cancellationToken: token); }
    public async Task SetContentLanguageAsync(string? language, string direction = "auto", CancellationToken token = default) { await WaitReadyAsync(token); await RequestAsync("contentLanguage", new { language, direction }, cancellationToken: token); }
    public void Dispose()
    {
        if (disposed) return; Dispatcher.VerifyAccess(); disposed = true; IsReady = false;
        var error = new ObjectDisposedException(nameof(EditorControl)); ready.TrySetException(error); foreach (var request in pending.Values) request.TrySetException(error); pending.Clear();
        foreach (var task in assetTasks.Values) task.Cancel();
        webView.Dispose();
        if (resourceDirectory is not null) { try { Directory.Delete(resourceDirectory, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
        GC.SuppressFinalize(this);
    }
}
