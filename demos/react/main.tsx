import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Wysiwyg, type WysiwygEditor } from '../../packages/react/src/index'
import type { DocumentInput, Format, Theme } from '../../packages/core/src/index'
import '../../packages/core/src/style.css'
import { samples, localImage, demoStyle } from '../shared'
const style = document.createElement('style')
style.textContent = demoStyle
document.head.append(style)
function App() {
  const [document, setDocument] = useState<DocumentInput>({
      id: 'react-initial',
      format: 'markdown',
      source: samples.markdown,
    }),
    [theme, setTheme] = useState<Theme>('system'),
    [locale, setLocale] = useState('en'),
    [readOnly, setReadOnly] = useState(false),
    [status, setStatus] = useState(''),
    [output, setOutput] = useState(''),
    [error, setError] = useState(''),
    editor = useRef<WysiwygEditor | null>(null)
  return (
    <>
      <header>
        <a href="/">All demos</a>
        <h1>WysiwygKit · React</h1>
        <nav>
          <label>
            Format{' '}
            <select
              value={document.format}
              onChange={(e) => {
                const format = e.target.value as Format
                setDocument({ id: crypto.randomUUID(), format, source: samples[format] })
              }}
            >
              {Object.keys(samples).map((format) => (
                <option key={format}>{format}</option>
              ))}
            </select>
          </label>
          <label>
            Theme{' '}
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {['system', 'light', 'dark'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            UI language{' '}
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="en">English</option>
              <option value="sv">Svenska</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            Read only
          </label>
          <button
            onClick={() =>
              void editor.current
                ?.getSnapshot()
                .then((snapshot) => {
                  setOutput(JSON.stringify(snapshot, null, 2))
                  editor.current?.markSaved(snapshot.revision, snapshot.id)
                })
                .catch((e) => setError(String(e)))
            }
          >
            Export snapshot
          </button>
        </nav>
        <div role="status">{status}</div>
        <div role="alert" className="error">
          {error}
        </div>
      </header>
      <main>
        <Wysiwyg
          document={document}
          theme={theme}
          locale={locale}
          readOnly={readOnly}
          uploadImage={localImage}
          resolveAsset={async (asset) => asset.uri}
          onReady={(value) => {
            editor.current = value
          }}
          onState={(state) =>
            setStatus(
              `${state.format} · revision ${state.revision} · ${state.dirty ? 'unsaved edits' : 'saved'}`,
            )
          }
          onError={(e) => setError(String(e))}
          onDiagnostic={(d) => setError(d.message)}
          onOpenLink={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
        />
        <details>
          <summary>Snapshot</summary>
          <textarea aria-label="Exported snapshot" readOnly value={output} />
        </details>
      </main>
    </>
  )
}
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
