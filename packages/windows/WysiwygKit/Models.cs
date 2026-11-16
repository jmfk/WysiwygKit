using System.Text.Json;
using System.Text.Json.Serialization;
namespace WysiwygKit;
[JsonConverter(typeof(JsonStringEnumConverter<DocumentFormat>))]
public enum DocumentFormat { markdown, html, fountain }
public sealed record EditorDocument(string Id, DocumentFormat Format, string Source, JsonElement? Metadata = null);
public sealed record EditorSnapshot(string Id, DocumentFormat Format, string Source, int Revision, JsonElement? Metadata)
{
    public EditorDocument Document => new(Id, Format, Source, Metadata);
}
public sealed record EditorState(string DocumentId, DocumentFormat Format, int Revision, bool Dirty, bool ReadOnly);
public sealed record EditorDiagnostic(string Code, string Message, string Severity);
public sealed record EditorConfiguration(string Theme = "system", string Locale = "en", bool ReadOnly = false, bool Toolbar = true, string UiDirection = "auto", bool AllowRemoteImages = false);
public sealed class EditorException(string code, string message) : Exception(message) { public string Code { get; } = code; }
public enum EditorCommand
{
    bold, italic, underline, strike, code, heading, paragraph, bulletList, orderedList, taskList, blockquote, codeBlock, horizontalRule,
    undo, redo, link, unlink, openLink, image, imageAlt, imageFocus, table, addRow, addColumn, deleteRow, deleteColumn, deleteTable, mergeCells, splitCell,
    screenplay, find, replace, replaceAll, pastePlain, cancelUpload
}
public sealed record EditorAsset(string Id, string Version, int Width, int Height, string Uri);
public sealed record ImageUpload(string Name, string MimeType, string DataURL, int Width, int Height)
{
    public byte[] Bytes => Convert.FromBase64String(DataURL[(DataURL.IndexOf(',') + 1)..]);
}
