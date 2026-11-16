import { useEffect, useRef, type CSSProperties } from 'react'
import { createEditor, type WysiwygEditor, type EditorOptions } from '@wysiwygkit/core'
export type WysiwygProps = EditorOptions & {
  className?: string
  style?: CSSProperties
  onReady?: (editor: WysiwygEditor) => void
  onError?: (error: unknown) => void
}
/** A document is replaced only when its ID changes. Same-ID echoes never reset selection/history. */
export function Wysiwyg({ className, style, ...options }: WysiwygProps) {
  const mount = useRef<HTMLDivElement>(null),
    instance = useRef<WysiwygEditor | null>(null),
    latest = useRef(options),
    loaded = useRef(options.document.id)
  latest.current = options
  useEffect(() => {
    const editor = createEditor(mount.current!, {
      ...latest.current,
      onChange: (state) => latest.current.onChange?.(state),
      onState: (state) => latest.current.onState?.(state),
      onDiagnostic: (d) => latest.current.onDiagnostic?.(d),
      onOpenLink: (url) => latest.current.onOpenLink?.(url),
      onAutosave: latest.current.onAutosave ? (s) => latest.current.onAutosave?.(s) : undefined,
    })
    instance.current = editor
    loaded.current = latest.current.document.id
    void editor.ready
      .then(() => {
        if (instance.current === editor) latest.current.onReady?.(editor)
      })
      .catch((error) => {
        if (instance.current === editor) latest.current.onError?.(error)
      })
    return () => {
      instance.current = null
      editor.dispose()
    }
  }, [])
  useEffect(() => {
    const editor = instance.current
    if (!editor) return
    editor.configure({
      theme: options.theme,
      locale: options.locale,
      uiDirection: options.uiDirection,
      readOnly: options.readOnly,
      toolbar: options.toolbar,
      messages: options.messages,
      allowRemoteImages: options.allowRemoteImages,
      uploadImage: options.uploadImage,
      resolveAsset: options.resolveAsset,
      onAutosave: options.onAutosave ? (s) => latest.current.onAutosave?.(s) : undefined,
    })
    if (loaded.current !== options.document.id) {
      loaded.current = options.document.id
      void editor.loadDocument(options.document).catch((error) => latest.current.onError?.(error))
    }
  })
  return <div ref={mount} className={className} style={style} />
}
export type { EditorOptions, DocumentInput, Snapshot, WysiwygEditor } from '@wysiwygkit/core'
