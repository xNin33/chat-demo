import { useEffect, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { getFileExt } from '../../services/attachments.js'
import { loadFile } from '../../services/chat/db.js'
import type { FileAttachment } from '../../services/chat/types.js'
import { downloadBlob } from '../../utils/download.js'
import { Button } from '../base/Button.js'
import styles from './SidePreview.module.css'

const PREVIEW_BYTES = 256 * 1024
const nonTextExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'epub',
  'mobi',
])
// eslint-disable-next-line no-control-regex
const binaryControls = /[\x00-\x08\x0b\x0e-\x1f]/

const readPreviewText = async (blob: Blob, name: string, truncated: boolean) => {
  if (nonTextExtensions.has(getFileExt(name))) {
    return null
  }
  const bytes = new Uint8Array(await blob.slice(0, PREVIEW_BYTES).arrayBuffer())
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : 'utf-8'
  const decode = (format: string) =>
    new TextDecoder(format, { fatal: true }).decode(bytes, { stream: truncated })
  let text: string
  try {
    text = decode(encoding)
  } catch {
    if (encoding !== 'utf-8') {
      return null
    }
    try {
      text = decode('gb18030')
    } catch {
      return null
    }
  }
  return binaryControls.test(text) || text.startsWith('%PDF-') ? null : text
}

type PreviewContent = { blob: Blob; text: string | null; truncated: boolean }

export const FilePreview = ({ file }: { file: FileAttachment }) => {
  const t = useTranslate()
  const { id, name } = file
  const [content, setContent] = useState<PreviewContent | null>()
  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const blob = await loadFile(id)
      if (cancelled) {
        return
      }
      if (!blob) {
        setContent(null)
        return
      }
      const truncated = blob.size > PREVIEW_BYTES
      const text = await readPreviewText(blob, name, truncated)
      if (!cancelled) {
        setContent({ blob, text, truncated })
      }
    }
    void read().catch(() => {
      if (!cancelled) {
        setContent(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, name])

  return (
    <div id="file-preview" className={styles.content} aria-busy={content === undefined}>
      {content === undefined ? (
        <p className={styles.notice} role="status">
          {t('filePreviewLoading')}
        </p>
      ) : content === null ? (
        <p className={styles.notice} role="status">
          {t('filePreviewMissing')}
        </p>
      ) : (
        <>
          {(content.text === null || content.truncated) && (
            <div className={styles.notice}>
              <p>
                {t(content.text === null ? 'filePreviewUnsupported' : 'filePreviewTruncated', {
                  size: PREVIEW_BYTES / 1024,
                })}
              </p>
              <Button size="s" variant="outlined" onClick={() => downloadBlob(content.blob, name)}>
                {t('downloadFile')}
              </Button>
            </div>
          )}
          {content.text !== null && <pre className={styles.text}>{content.text}</pre>}
        </>
      )}
    </div>
  )
}
