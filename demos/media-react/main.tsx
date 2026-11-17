import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Wysiwyg } from '../../packages/react/src/index'
import { initialDocument, media, mountMediaDemo } from '../media/demo'
createRoot(document.getElementById('editor')!).render(
  <StrictMode>
    <Wysiwyg
      document={initialDocument}
      uploadImage={media.uploadImage}
      resolveAsset={media.resolveAsset}
      onReady={mountMediaDemo}
    />
  </StrictMode>,
)
