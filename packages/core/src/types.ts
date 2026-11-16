export type Format = 'markdown' | 'html' | 'fountain'
export type Theme = 'system' | 'light' | 'dark'
export type Direction = 'auto' | 'ltr' | 'rtl'
export type Diagnostic = { code: string; message: string; severity: 'warning' | 'error' }
export type Point = { x: number; y: number }
export type Asset = { id: string; version: string; width: number; height: number; uri: string }
export type ImageMetadata = {
  occurrenceId: string
  asset?: Asset
  focus?: Point
  aspectRatio?: number
  caption?: string
}
export type Sidecar = {
  schemaVersion: 1
  sourceDigest: string
  language?: string
  direction: Direction
  images: { start: number; end: number; metadata: ImageMetadata }[]
}
export type DocumentInput = { id: string; format: Format; source: string; metadata?: Sidecar }
export type Snapshot = DocumentInput & { revision: number }
export type EditorState = {
  documentId: string
  format: Format
  revision: number
  dirty: boolean
  readOnly: boolean
}
export type EditorOptions = {
  document: DocumentInput
  theme?: Theme
  locale?: string
  uiDirection?: Direction
  language?: string
  direction?: Direction
  readOnly?: boolean
  toolbar?: boolean
  allowRemoteImages?: boolean
  messages?: Record<string, string>
  onChange?: (state: EditorState) => void
  onState?: (state: EditorState) => void
  onDiagnostic?: (diagnostic: Diagnostic) => void
  onOpenLink?: (url: string) => void
  onAutosave?: (snapshot: Snapshot) => void | Promise<void>
  autosaveDelay?: number
  uploadImage?: (file: File, signal: AbortSignal) => Promise<Asset>
  resolveAsset?: (asset: Asset, signal: AbortSignal) => Promise<string>
}
export type CommandId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'heading'
  | 'paragraph'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'undo'
  | 'redo'
  | 'link'
  | 'unlink'
  | 'openLink'
  | 'image'
  | 'imageAlt'
  | 'imageFocus'
  | 'table'
  | 'addRow'
  | 'addColumn'
  | 'deleteRow'
  | 'deleteColumn'
  | 'deleteTable'
  | 'mergeCells'
  | 'splitCell'
  | 'screenplay'
  | 'find'
  | 'replace'
  | 'replaceAll'
  | 'pastePlain'
  | 'cancelUpload'
export class EditorError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'EditorError'
  }
}
