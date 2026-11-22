import clsx from 'clsx'
import { memo, useState, type ReactNode } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { isPreviewImage, useUploads, type UploadTask } from '../../services/attachments.js'
import type { DraftAttachment } from '../../services/chat/drafts.js'
import { IconCloseFill14, IconRefreshOutline16 } from '../base/icons.js'
import { Tooltip } from '../base/Tooltip.js'
import { FileCard } from '../files/FileCard.js'
import { ImagePreview } from '../files/ImagePreview.js'
import { useImagePreviewUrl } from '../files/useFileView.js'
import styles from './ChatInput.module.css'

const UPLOADING: UploadTask = { status: 'uploading' }

/** 输入框共用的附件栏；已有附件排在新附件前面。 */
export const DraftAttachments = memo(function DraftAttachments({
  items,
  retained,
  onRetry,
  onRemove,
}: {
  items: DraftAttachment[]
  retained?: ReactNode
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const images = items.filter((item) => isPreviewImage(item.file.name))
  const activeIndex = images.findIndex((item) => item.id === previewId)
  const active = images[activeIndex]
  const previewUrl = useImagePreviewUrl(active?.file, active?.file.name ?? '')
  if (items.length === 0 && !retained) {
    return null
  }
  return (
    <div className={styles.attachments}>
      {retained}
      {items.map((item) => (
        <AttachmentItem
          key={item.id}
          item={item}
          onPreview={() => setPreviewId(item.id)}
          onRetry={() => onRetry(item.id)}
          onRemove={() => onRemove(item.id)}
        />
      ))}
      {active && (
        <ImagePreview
          src={previewUrl ?? undefined}
          name={active.file.name}
          onClose={() => setPreviewId(null)}
          onStep={
            images.length > 1
              ? (direction) => {
                  setPreviewId(images[(activeIndex + direction + images.length) % images.length].id)
                }
              : undefined
          }
        />
      )}
    </div>
  )
})

/** 输入框里的文件：图片显示缩略图，其余显示文件卡片 */
const AttachmentItem = ({
  item,
  onRetry,
  onRemove,
  onPreview,
}: {
  item: DraftAttachment
  onRetry: () => void
  onRemove: () => void
  onPreview: () => void
}) => {
  const t = useTranslate()
  const previewUrl = useImagePreviewUrl(item.file, item.file.name)
  const task = useUploads((state) => state.tasks[item.id] ?? UPLOADING)
  const status = task.status
  const error = task.status === 'error' ? t(task.error.key, task.error.params) : undefined
  // 过大、格式不支持等重试无效的失败只提示原因，需删除后再发送
  const retry = task.status === 'error' && task.retryable ? onRetry : undefined
  const failed = status === 'error'
  const retryLabel = t('uploadRetry', { message: error ?? t('uploadFileStatusFailed') })
  // 「上传失败」只显示重试图标，其余原因写在图片上：可重试时在图标下方，不可重试时贴底
  const showReason = failed && error !== undefined && error !== t('uploadFileStatusFailed')
  return isPreviewImage(item.file.name) ? (
    <div
      className={clsx(styles.attachment, failed && styles.attachmentFailed)}
      title={error ?? item.file.name}
    >
      <button
        type="button"
        className={styles.attachmentPreview}
        aria-label={t('previewImage', { name: item.file.name })}
        disabled={!previewUrl}
        onClick={onPreview}
      >
        {previewUrl && <img src={previewUrl} alt={item.file.name} />}
      </button>
      {status === 'uploading' ? <div className={styles.uploading} /> : null}
      {failed ? (
        <div className={clsx(styles.failed, styles.failedStatic)} aria-label={error}>
          {showReason ? <span className={styles.failedReason}>{error}</span> : null}
        </div>
      ) : null}
      {failed && retry ? (
        <Tooltip content={retryLabel}>
          <button type="button" className={styles.attachmentRetry} aria-label={retryLabel} onClick={retry}>
            <IconRefreshOutline16 />
          </button>
        </Tooltip>
      ) : null}
      <button
        type="button"
        className={clsx(styles.remove, failed && !retry && styles.invalidRemove)}
        aria-label={t('delete')}
        onClick={onRemove}
      >
        <IconCloseFill14 />
      </button>
    </div>
  ) : (
    <FileCard
      name={item.file.name}
      size={item.file.size}
      status={status}
      error={error}
      onRetry={retry}
      onRemove={onRemove}
    />
  )
}
