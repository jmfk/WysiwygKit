using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using WysiwygKit;
namespace WysiwygDemo;
public partial class MainWindow : Window
{
    private EditorControl? editor;
    public MainWindow()
    {
        InitializeComponent(); editor = new(new(Guid.NewGuid().ToString(), DocumentFormat.markdown, "# WysiwygKit\n\nEdit **Markdown**, HTML and Fountain.\n\n| Feature | State |\n| --- | --- |\n| Tables | Editable |")); EditorHost.Content = editor;
        editor.DocumentChanged += state => Status.Text = $"{state.Format} · revision {state.Revision} · {(state.Dirty ? "unsaved edits" : "saved")}";
        editor.Diagnostic += diagnostic => Error.Text = diagnostic.Message; editor.Failed += error => Error.Text = error.Message;
        Closed += (_, _) => editor.Dispose();
    }
    private static string Value(ComboBox combo) => (combo.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "";
    private async void FormatChanged(object sender, RoutedEventArgs e)
    {
        if (editor is null) return;
        try { var format = Enum.Parse<DocumentFormat>(Value(Format)); var source = format == DocumentFormat.fountain ? "Title: A NEW SCENE\n\nINT. ROOM - DAY\n\nALEX\nLet's begin.\n\n[[Keep this note.]]\n" : format == DocumentFormat.html ? "<h1>Publish</h1><p>Edit <strong>HTML</strong>.</p>" : "# Write\n\nEdit **Markdown**."; await editor.LoadAsync(new(Guid.NewGuid().ToString(), format, source)); } catch (Exception error) { Error.Text = error.Message; }
    }
    private async void ConfigChanged(object sender, RoutedEventArgs e)
    {
        if (editor is null) return;
        try { await editor.ConfigureAsync(new(Value(Theme), Value(Locale), ReadOnly.IsChecked == true)); } catch (Exception error) { Error.Text = error.Message; }
    }
    private async void Export(object sender, RoutedEventArgs e)
    {
        if (editor is null) return;
        try { var snapshot = await editor.SnapshotAsync(); Output.Text = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true }); await editor.MarkSavedAsync(snapshot); } catch (Exception error) { Error.Text = error.Message; }
    }
}
