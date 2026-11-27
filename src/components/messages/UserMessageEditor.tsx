import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  ACCEPT,
  isPreviewImage,
  MAX_COUNT,
  MAX_SIZE_MB,
  MAX_USER_DATA_SIZE_MB,
  useUploads,
} from '../../services/attachments.js'
import {
  addDraftFiles,
  clearDraft,
  EMPTY_DRAFT,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  useDrafts,
} from '../../services/chat/drafts.js'
import { editMessage, useChatStore } from '../../services/chat/store.js'
import type { UserMessage } from '../../services/chat/types.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import {
  IconAttachPlus20,
  IconCloseFill14,
  IconPaperclipOutline16,
  IconSendOutline16,
} from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import { ChatToggles } from '../chatInput/ChatToggles.js'
import composerStyles from '../chatInput/ChatInput.module.css'
import { DraftAttachments } from '../chatInput/DraftAttachments.js'
import { hasDraggedFiles } from '../chatInput/DragMask.js'
import { MobileAttachmentPicker } from '../chatInput/MobileAttachmentPicker.js'
import type { CloseMessageComposer } from '../chatInput/messageComposer.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { MessageFile } from './MessageFile.js'
import styles from './UserMessage.module.css'

export const UserMessageEditor = ({
  sessionId,
  message,
  busy,
  mobile = false,
  onClose,
}: {
  sessionId: string
  message: UserMessage
  busy: boolean
  mobile?: boolean
  onClose: CloseMessageComposer
}) => {
  const t = useTranslate()
  const [draft, setDraft] = useState(message.content)
  const [attachmentDraft] = useState(() => Symbol())
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [dragging, setDragging] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const dragDepth = useRef(0)
  const pickerRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const attachments = useDrafts(
    (state) => state.drafts.get(attachmentDraft)?.attachments ?? EMPTY_DRAFT.attachments
  )
  const importing = useChatStore((state) => state.importingHistory)
  const disabled = busy || importing
  const files = message.files.filter((file) => !removedIds.has(file.id))
  const ready = useUploads(
    (state) => prepareDraftMessage({ text: draft, attachments }, state.tasks, files.length) !== null
  )

  useEffect(() => () => clearDraft(attachmentDraft), [attachmentDraft])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 202)}px`
    }
  }, [draft])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.focus({ preventScroll: mobile })
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
      textarea.scrollTop = textarea.scrollHeight
    }
  }, [mobile])

  const addFiles = (selected: File[]) => {
    if (selected.length && !disabled && ensureApiKey()) {
      const error = addDraftFiles(attachmentDraft, selected, files.length)
      if (error) {
        showToast(error)
      }
    }
  }

  const send = () => {
    if (disabled || !ready || !ensureApiKey()) {
      return
    }
    onClose(() => {
      if (!editMessage(sessionId, message.id, draft, removedIds, attachmentDraft)) {
        return false
      }
      stopReadAloud()
      return true
    })
  }

  return (
    <div
      className={styles.editor}
      data-editor-composer={mobile}
      onDragEnter={(event) => {
        if (hasDraggedFiles(event)) {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }
      }}
      onDragOver={(event) => {
        if (hasDraggedFiles(event)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
        }
      }}
      onDragLeave={(event) => {
        if (hasDraggedFiles(event) && --dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDrop={(event) => {
        if (hasDraggedFiles(event)) {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }
      }}
    >
      <DraftAttachments
        items={attachments}
        retained={
          files.length
            ? files.map((file) => (
                <div key={file.id} className={styles.retainedFile}>
                  <MessageFile file={file} onRetry={null} />
                  <button
                    type="button"
                    className={styles.removeAttachment}
                    aria-label={t(isPreviewImage(file.name) ? 'removeImage' : 'removeAttachment', {
                      name: file.name,
                    })}
                    disabled={disabled}
                    onClick={() => setRemovedIds((current) => new Set([...current, file.id]))}
                  >
                    <IconCloseFill14 />
                  </button>
                </div>
              ))
            : null
        }
        onRemove={(id) => removeDraftAttachment(attachmentDraft, id)}
        onRetry={(id) => {
          if (!disabled && ensureApiKey()) {
            retryDraftAttachment(attachmentDraft, id)
          }
        }}
      />
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        aria-label={t('editMessage')}
        rows={1}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onPaste={(event) => {
          const pasted = Array.from(event.clipboardData.files)
          if (pasted.length) {
            event.preventDefault()
            addFiles(pasted)
          }
        }}
        onKeyDown={(event) => {
          if (mobile || event.nativeEvent.isComposing) {
            return
          }
          if (event.key === 'Escape') {
            onClose()
          } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
            event.preventDefault()
            send()
          }
        }}
      />
      {mobile ? (
        <>
          <div className={composerStyles.functionRow}>
            <ChatToggles allowSettings={false} />
            <div className={composerStyles.right}>
              <IconButton
                size="m"
                tone="primary"
                icon={<IconAttachPlus20 />}
                className="attachment-plus"
                aria-label={t(attachmentOpen ? 'attachmentCloseTray' : 'attachmentOpenTray')}
                aria-expanded={attachmentOpen}
                disabled={disabled}
                onClick={() => {
                  textareaRef.current?.blur()
                  setAttachmentOpen((open) => !open)
                }}
              />
              <button
                type="button"
                className={clsx(
                  composerStyles.sendButton,
                  (disabled || !ready) && composerStyles.disabled
                )}
                aria-label={t('send')}
                disabled={disabled || !ready}
                onClick={send}
              >
                <IconSendOutline16 />
              </button>
            </div>
          </div>
          <MobileAttachmentPicker
            open={attachmentOpen}
            close={() => setAttachmentOpen(false)}
            onFiles={addFiles}
          />
        </>
      ) : (
        <div className={styles.editorActions}>
          <input
            ref={pickerRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              addFiles(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }}
          />
          <IconButton
            icon={<IconPaperclipOutline16 />}
            tooltip={t('uploadFile')}
            tone="primary"
            disabled={disabled}
            onClick={() => pickerRef.current?.click()}
          />
          <Button size="s" variant="outlined" onClick={() => onClose()}>
            {t('cancel')}
          </Button>
          <Button size="s" disabled={disabled || !ready} onClick={send}>
            {t('send')}
          </Button>
        </div>
      )}
      {dragging && !disabled && (
        <div className={styles.editorDrop} role="status">
          <span>{t('dragFileToUpload')}</span>
          <span>
            {t('editorDropLimits', {
              count: MAX_COUNT,
              size: MAX_SIZE_MB,
              smallerSize: MAX_USER_DATA_SIZE_MB,
            })}
          </span>
        </div>
      )}
    </div>
  )
}
