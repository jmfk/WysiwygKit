using System.Windows;
using WysiwygKit;
static class Program
{
    [STAThread] static int Main()
    {
        var app = new Application(); var exitCode = 1;
        app.Startup += async (_, _) =>
        {
            var editor = new EditorControl(new("windows-smoke", DocumentFormat.markdown, "# Native\n\nHello **world**."));
            var window = new Window { Content = editor, Width = 800, Height = 600, Title = "WysiwygKit regression" }; window.Show();
            try
            {
                var initial = await editor.SnapshotAsync();
                if (!initial.Source.Contains("# Native") || initial.Metadata is null) throw new Exception("Initial snapshot failed.");
                await editor.CommandAsync(EditorCommand.replaceAll, new { text = "Hello", replacement = "Hej" });
                var changed = await editor.SnapshotAsync();
                if (!changed.Source.Contains("Hej") || changed.Revision <= initial.Revision) throw new Exception("Edit/revision failed.");
                try { await editor.CommandAsync(EditorCommand.bold, documentId: "wrong"); throw new Exception("Stale document accepted."); } catch (EditorException e) when (e.Code == "STALE_DOCUMENT") { }
                var script = new EditorDocument("script", DocumentFormat.fountain, "Title: Test\n\nINT. ROOM - DAY\n\nALEX\nHello.\n\n[[Keep me]]\n");
                await editor.LoadAsync(script); if ((await editor.SnapshotAsync()).Source != script.Source) throw new Exception("Fountain source changed.");
                await editor.ConfigureAsync(new(ReadOnly: true)); if (await editor.CommandAsync(EditorCommand.bold)) throw new Exception("Read-only mutation accepted.");
                Console.WriteLine("PASS: real WebView2 load, edit, snapshot, stale-document, Fountain and read-only checks."); exitCode = 0;
            }
            catch (Exception error) { Console.Error.WriteLine($"FAIL: {error.GetType().Name}: {error.Message}"); }
            finally { editor.Dispose(); window.Close(); app.Shutdown(); }
        };
        app.Run(); return exitCode;
    }
}
