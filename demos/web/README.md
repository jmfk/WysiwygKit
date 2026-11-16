# Plain-web demo

From the repository root: `npm ci && npm run dev`. Open http://localhost:13700/demos/web/.

Select Markdown, HTML or Fountain. All use the same public core API. Theme/UI language/read-only changes do not replace content. Content direction is independent of UI direction. Use Command-K / Control-K for all available commands.

The image picker uses local data-URI storage with a 4 MB/32 megapixel limit; files are not uploaded. Select an image and open Image focus in the palette for non-destructive focus controls. Tables and images are available for Markdown/HTML, not Fountain. Remote previews require explicit host policy.

Export a snapshot to retain source and metadata together. Plain-source loading can require explicit acceptance of normalization. Opt-in recovery stores one bounded copy per format in this browser profile for 24 hours; it may contain private text and is not a last-keystroke crash guarantee. It is disabled by default.
