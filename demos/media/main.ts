import { createEditor } from '../../packages/core/src/index'
import { initialDocument, media, mountMediaDemo } from './demo'
const editor = createEditor(document.getElementById('editor')!, {
  document: initialDocument,
  uploadImage: media.uploadImage,
  resolveAsset: media.resolveAsset,
})
void editor.ready
  .then(() => mountMediaDemo(editor))
  .catch(() => {
    document.getElementById('media-error')!.textContent = 'The editor could not initialize.'
  })
