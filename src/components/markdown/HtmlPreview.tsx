import { useMemo } from 'react'
import { useTranslate } from '../../i18n/index.js'
import styles from '../files/SidePreview.module.css'

// 仅允许预览自身的内联代码和嵌入资源。alert 用框架内对话框显示。
const buildPreviewDocument = (code: string, dismissLabel: string) => `<!doctype html>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; base-uri 'none'; form-action 'none'">
<script>
window.alert = (message = '') => {
  const dialog = document.createElement('dialog');
  const text = document.createElement('p');
  const close = document.createElement('button');
  text.textContent = String(message);
  close.textContent = ${JSON.stringify(dismissLabel)};
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.append(text, close);
  (document.body || document.documentElement).append(dialog);
  dialog.showModal();
};
</script>
${code.replace(/^\s*<!doctype\s+html[^>]*>/i, '')}`

export const HtmlPreview = ({ code, title }: { code: string; title: string }) => {
  const t = useTranslate()
  const srcDoc = useMemo(() => buildPreviewDocument(code, t('confirm')), [code, t])
  return (
    <iframe
      id="html-preview"
      className={styles.frame}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
    />
  )
}
