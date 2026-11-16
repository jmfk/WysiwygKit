import type { Format } from '../packages/core/src/types'
export const samples: Record<Format, string> = {
  markdown:
    '# A place to write\n\nEdit **Markdown** with images, tables and *your own words*.\n\n| Platform | Format |\n| --- | --- |\n| Web & React | Markdown |\n| Swift & Windows | HTML and Fountain |\n\n- Local by default\n- One shared engine\n\n## Mixed languages\n\nHej världen. مرحبًا بالعالم. こんにちは世界。\n',
  html: '<h1>A place to publish</h1><p>Edit <strong>HTML</strong> for your website.</p><table><tbody><tr><th>Feature</th><th>Status</th></tr><tr><td>Images and tables</td><td>Editable</td></tr></tbody></table><p lang="ar" dir="rtl">مرحبًا بالعالم. <bdi dir="ltr">WysiwygKit</bdi></p>',
  fountain:
    'Title: THE QUIET ROOM\nAuthor: WysiwygKit contributors\n\n# Act One\n= An unexpected delivery.\n\nINT. WRITING ROOM - DAY #1#\n\nA writer opens a blank document. A small light blinks.\n\nALEX\n(quietly)\nEvery story starts somewhere.\n\n@ليلى\nوماذا يحدث بعد ذلك؟\n\n[[Keep this note when saving.]]\n\n> FADE OUT.\n\n> THE END <\n',
}
export { localDataAsset as localImage } from '../packages/core/src/media'
export const demoStyle = `:root{font-family:system-ui;color-scheme:light dark}body{margin:0;background:light-dark(#f7f7f7,#111);color:light-dark(#222,#eee)}header,main{max-width:74rem;margin:auto;padding:1.25rem}header h1{font-size:1.7rem;margin:.5rem 0}nav{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;margin-block:1rem}label{display:flex;gap:.5rem;align-items:center}select,button{font:inherit;min-height:44px;padding:.3rem .6rem}textarea{width:100%;min-height:16rem;font:14px/1.6 ui-monospace,monospace;box-sizing:border-box;padding:1rem}summary{cursor:pointer;padding-block:1rem}a{color:inherit}.error{color:light-dark(#a02020,#ffaaaa)}.demo-status{min-height:1.8rem;font-size:.9rem}`
