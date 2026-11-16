import {
  createEditor,
  type WysiwygEditor,
  type DocumentInput,
  type EditorOptions,
  commandIds,
  EditorError,
  localDataAsset,
} from '../core/src/index'
import '../core/src/style.css'
export const protocolVersion = 1
const engineVersion = '0.1.0'
type Request = {
  protocolVersion: number
  id: string
  operation: string
  payload?: Record<string, unknown>
  documentId?: string
  revision?: number
}
type NativeWindow = Window & {
  webkit?: { messageHandlers?: { wysiwyg?: { postMessage: (data: unknown) => void } } }
  chrome?: {
    webview?: {
      postMessage: (data: unknown) => void
      addEventListener: (name: string, callback: (event: { data: unknown }) => void) => void
    }
  }
  wysiwygNative?: unknown
}
const native = window as NativeWindow
let editor: WysiwygEditor | undefined
const assetRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()
function requestAsset(kind: string, payload: unknown, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = setTimeout(
      () => finish(new EditorError('ASSET_TIMEOUT', 'The host did not resolve the asset in time.')),
      30_000,
    )
    const abort = () => {
      send({ type: 'assetCancel', protocolVersion, assetRequestId: id })
      finish(new DOMException('Cancelled', 'AbortError'))
    }
    function finish(error?: Error, value?: unknown) {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      assetRequests.delete(id)
      if (error) reject(error)
      else resolve(value)
    }
    assetRequests.set(id, {
      resolve: (value) => finish(undefined, value),
      reject: (error) => finish(error),
    })
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }
    send({ type: 'assetRequest', protocolVersion, assetRequestId: id, kind, payload })
  })
}
function send(data: unknown) {
  native.webkit?.messageHandlers?.wysiwyg?.postMessage(data)
  native.chrome?.webview?.postMessage(data)
}
function fail(code: string, message: string): never {
  throw new EditorError(code, message)
}
async function receive(raw: unknown) {
  let id = ''
  try {
    if (window.top !== window) fail('FRAME_REJECTED', 'The editor must be the main frame.')
    if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > 12_000_000)
      fail('INVALID_REQUEST', 'Invalid or oversized bridge request.')
    const request = raw as Request
    id = typeof request.id === 'string' ? request.id : ''
    if (
      request.protocolVersion !== protocolVersion ||
      !id ||
      id.length > 128 ||
      typeof request.operation !== 'string'
    )
      fail('PROTOCOL_MISMATCH', 'Unsupported bridge protocol or request ID.')
    const payload = request.payload ?? {}
    let result: unknown = null
    if (request.operation === 'assetResponse') {
      const pending = assetRequests.get(String(payload.assetRequestId))
      if (pending) {
        if (payload.error) pending.reject(new EditorError('ASSET_FAILED', String(payload.error)))
        else pending.resolve(payload.result)
      }
      return { id, protocolVersion, ok: true, result: !!pending }
    }
    if (request.operation === 'initialize') {
      editor?.dispose()
      editor = undefined
      for (const request of assetRequests.values())
        request.reject(new EditorError('DISPOSED', 'The editor was replaced.'))
      assetRequests.clear()
      const config = payload.configuration as
        (Partial<EditorOptions> & { useHostUpload?: boolean; useHostResolve?: boolean }) | undefined
      const mount = document.getElementById('editor')!
      mount.replaceChildren()
      editor = createEditor(mount, {
        document: payload.document as DocumentInput,
        theme: config?.theme ?? 'system',
        locale: config?.locale ?? 'en',
        readOnly: !!config?.readOnly,
        toolbar: config?.toolbar !== false,
        uiDirection: config?.uiDirection,
        allowRemoteImages: !!config?.allowRemoteImages,
        uploadImage: async (file, signal) => {
          const local = await localDataAsset(file, signal)
          return config?.useHostUpload
            ? ((await requestAsset(
                'upload',
                {
                  name: file.name,
                  mimeType: file.type,
                  dataURL: local.uri,
                  width: local.width,
                  height: local.height,
                },
                signal,
              )) as import('../core/src/types').Asset)
            : local
        },
        resolveAsset: async (asset, signal) =>
          config?.useHostResolve
            ? ((await requestAsset('resolve', asset, signal)) as string)
            : asset.uri,
        onChange: (state) => send({ type: 'change', protocolVersion, state }),
        onDiagnostic: (diagnostic) => send({ type: 'diagnostic', protocolVersion, diagnostic }),
        onOpenLink: (url) => send({ type: 'openLink', protocolVersion, url }),
      })
      await editor.ready
      result = { engineVersion, protocolVersion, state: editor.state() }
    } else {
      if (!editor) fail('NOT_READY', 'Initialize the editor first.')
      await editor.ready
      const state = editor.state()
      if (request.documentId != null && request.documentId !== state.documentId)
        fail('STALE_DOCUMENT', 'The request belongs to another document.')
      if (request.revision != null && request.revision !== state.revision)
        fail('STALE_REVISION', 'The request belongs to an older revision.')
      switch (request.operation) {
        case 'snapshot':
          result = await editor.getSnapshot()
          break
        case 'load':
          result = await editor.loadDocument(payload.document as DocumentInput, {
            acceptNormalization: payload.acceptNormalization === true,
          })
          break
        case 'configure': {
          const config = payload as Partial<EditorOptions>
          editor.configure({
            theme: config.theme,
            locale: config.locale,
            readOnly: config.readOnly,
            toolbar: config.toolbar,
            uiDirection: config.uiDirection,
            allowRemoteImages: config.allowRemoteImages,
          })
          result = editor.state()
          break
        }
        case 'command':
          if (!commandIds.includes(payload.command as never))
            fail('UNKNOWN_COMMAND', 'Unknown editor command.')
          result = editor.execute(payload.command as never, payload.argument)
          break
        case 'markSaved':
          result = editor.markSaved(Number(payload.revision), String(payload.documentId))
          break
        case 'contentLanguage':
          result = editor.setContentLanguage(
            payload.language as string | undefined,
            payload.direction as never,
          )
          break
        case 'dispose':
          editor.dispose()
          editor = undefined
          result = true
          break
        default:
          fail('UNKNOWN_OPERATION', 'Unknown bridge operation.')
      }
    }
    return { id, protocolVersion, ok: true, result }
  } catch (error) {
    return {
      id,
      protocolVersion,
      ok: false,
      error: {
        code: error instanceof EditorError ? error.code : 'BRIDGE_ERROR',
        message: error instanceof Error ? error.message : 'The operation failed.',
      },
    }
  }
}
native.wysiwygNative = { receive, protocolVersion, engineVersion }
native.chrome?.webview?.addEventListener('message', (event) => {
  void receive(event.data).then((response) => send({ type: 'response', ...response }))
})
send({ type: 'bridgeReady', protocolVersion, engineVersion })
