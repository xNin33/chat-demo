import { useTranslate } from '../../i18n/index.js'
import { memo, useEffect, useMemo, useReducer, useState } from 'react'
import Prism from 'prismjs'
import {
  getHighlightLang,
  isHighlightLoaded,
  loadHighlight,
} from '../../services/markdown/highlight.js'
import {
  IconCheckOutline16,
  IconCopyOutline16,
  IconDownloadOutline16,
  IconPlayMediaOutline16,
} from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import { copyText } from '../../utils/clipboard.js'
import { downloadBlob } from '../../utils/download.js'
import { closeSearchPanel } from '../search/searchPanelState.js'
import { MermaidDiagram } from './MermaidDiagram.js'
import { openHtmlPreview } from '../files/sidePreviewState.js'
import styles from './CodeBlock.module.css'

const codeExtensions = new Map([
  ['bash', 'sh'],
  ['c', 'c'],
  ['cpp', 'cpp'],
  ['csharp', 'cs'],
  ['css', 'css'],
  ['go', 'go'],
  ['java', 'java'],
  ['javascript', 'js'],
  ['json', 'json'],
  ['jsx', 'jsx'],
  ['markdown', 'md'],
  ['mermaid', 'mmd'],
  ['powershell', 'ps1'],
  ['python', 'py'],
  ['ruby', 'rb'],
  ['rust', 'rs'],
  ['sql', 'sql'],
  ['tsx', 'tsx'],
  ['typescript', 'ts'],
  ['yaml', 'yaml'],
  ['xml', 'xml'],
  ['svg', 'svg'],
])

const CodeInfoRow = ({
  code,
  infostring,
  fileName,
  canRun,
  loading,
  showDiagram,
  onToggleDiagram,
}: {
  code: string
  infostring: string
  fileName: string
  canRun: boolean
  loading: boolean
  showDiagram: boolean
  onToggleDiagram?: () => void
}) => {
  const t = useTranslate()
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.container}>
      {onToggleDiagram ? (
        <div className="md-code-block-switch" aria-label={t('mermaidSwitchLabel')}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={showDiagram}
            onClick={() => !showDiagram && onToggleDiagram()}
          >
            {t('mermaidDiagram')}
          </button>
          <button
            type="button"
            className={styles.button}
            aria-pressed={!showDiagram}
            onClick={() => showDiagram && onToggleDiagram()}
          >
            {t('mermaidCode')}
          </button>
        </div>
      ) : (
        <span className={styles.name}>{infostring}</span>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={async () => {
            if (!(await copyText(code))) {
              showToast({ key: 'copyFailed' })
              return
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
          <span>{t(copied ? 'copied' : 'copy')}</span>
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label={t('downloadCode')}
          onClick={() =>
            downloadBlob(new Blob([code], { type: 'text/plain;charset=utf-8' }), fileName)
          }
        >
          <IconDownloadOutline16 />
          <span>{t('downloadCode')}</span>
        </button>
        {canRun && (
          <button
            type="button"
            className={styles.button}
            aria-label={t('runCode')}
            disabled={loading}
            onClick={() => {
              closeSearchPanel()
              openHtmlPreview(code)
            }}
          >
            <IconPlayMediaOutline16 />
            <span>{t('runCode')}</span>
          </button>
        )}
      </div>
    </div>
  )
}

/** 代码块：语言包按需加载，不支持或尚未加载的语言按纯文本显示 */
export const CodeBlock = memo(function CodeBlock({
  code,
  infostring,
  loading = false,
}: {
  code: string
  infostring: string
  loading?: boolean
}) {
  const language = infostring.trim().toLowerCase()
  const isMermaid = language === 'mermaid'
  const isHtml = ['html', 'htm', 'html5'].includes(language)
  const [showDiagram, setShowDiagram] = useState(true)
  // 语言包注册在全局 Prism 上，每次渲染直接判断；加载完成后触发一次重渲染
  const rerender = useReducer((n: number) => n + 1, 0)[1]
  const lang = getHighlightLang(isHtml ? 'html' : language)
  const extension = codeExtensions.get(language) ?? codeExtensions.get(lang ?? '') ?? 'txt'
  const loaded = lang !== null && isHighlightLoaded(lang)
  useEffect(() => {
    if (lang === null || loaded) {
      return
    }
    let unmounted = false
    loadHighlight(lang).then(() => {
      if (!unmounted) {
        rerender()
      }
    })
    return () => {
      unmounted = true
    }
  }, [lang, loaded, rerender])
  const renderedHtml = useMemo(() => {
    const name = lang !== null && loaded ? lang : 'plaintext'
    return Prism.highlight(code, Prism.languages[name], name)
  }, [code, lang, loaded])
  return (
    <div className="md-code-block">
      <div className="md-code-block-banner">
        <CodeInfoRow
          code={code}
          infostring={infostring}
          fileName={isHtml ? 'index.html' : `code.${extension}`}
          canRun={isHtml}
          loading={loading}
          showDiagram={showDiagram}
          onToggleDiagram={isMermaid ? () => setShowDiagram((show) => !show) : undefined}
        />
      </div>
      {isMermaid && showDiagram ? (
        <MermaidDiagram code={code} loading={loading} />
      ) : (
        <pre dangerouslySetInnerHTML={{ __html: renderedHtml }}></pre>
      )}
    </div>
  )
})
