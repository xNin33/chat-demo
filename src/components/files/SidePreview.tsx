import { useRef, useState, type CSSProperties } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { playExit } from '../base/playExit.js'
import { HtmlPreview } from '../markdown/HtmlPreview.js'
import { FilePreview } from './FilePreview.js'
import { closeSidePreview, useSidePreview } from './sidePreviewState.js'
import styles from './SidePreview.module.css'

const MIN_WIDTH = 26
const MAX_WIDTH = 65
const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))

export const SidePreview = () => {
  const t = useTranslate()
  const panel = useRef<HTMLElement>(null)
  const preview = useSidePreview((state) => state.preview)
  const [widths, setWidths] = useState({ html: 34, file: 50 })
  if (!preview) {
    return null
  }
  const { kind } = preview
  const width = widths[kind]
  const title = kind === 'html' ? preview.title || t('htmlPreview') : preview.file.name
  const label = kind === 'html' ? t('htmlPreview') : t('previewFile', { name: title })
  const resize = (value: number) =>
    setWidths((current) => ({
      ...current,
      [kind]: clampWidth(value),
    }))

  return (
    <aside
      ref={panel}
      className={styles.panel}
      aria-label={label}
      data-motion="fade"
      style={{ '--preview-width': `${width}%` } as CSSProperties}
    >
      <div
        className={styles.divider}
        role="separator"
        tabIndex={0}
        aria-label={t(kind === 'html' ? 'resizeHtmlPreview' : 'resizeFilePreview')}
        aria-orientation="vertical"
        aria-controls={`${kind}-preview`}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        onPointerDown={(event) => {
          if (event.button === 0) {
            event.currentTarget.setPointerCapture(event.pointerId)
          }
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            const frame = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
            if (frame?.width) {
              resize((100 * (frame.right - event.clientX)) / frame.width)
            }
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            resize(width + (event.key === 'ArrowLeft' ? 3 : -3))
          }
        }}
      />
      <header className={styles.header}>
        <span className={styles.title} title={title}>
          {title}
        </span>
        <IconButton
          icon={<IconCloseOutline16 />}
          aria-label={t('close')}
          onClick={() =>
            playExit(panel.current, () => {
              if (useSidePreview.getState().preview === preview) {
                closeSidePreview()
              }
            })
          }
        />
      </header>
      {kind === 'html' ? (
        <HtmlPreview key={preview.run} code={preview.code} title={title} />
      ) : (
        <FilePreview key={preview.file.id} file={preview.file} />
      )}
    </aside>
  )
}
