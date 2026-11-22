import { useTranslate } from '../../i18n/index.js'
import clsx from 'clsx'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { IconCloseFill14, IconEditOutline16, IconPaperclipOutline16 } from '../base/icons.js'
import { editMessage, retryUpload, useChatStore } from '../../services/chat/store.js'
import {
  ACCEPT,
  MAX_COUNT,
  MAX_SIZE_MB,
  MAX_USER_DATA_SIZE_MB,
  useUploads,
} from '../../services/attachments.js'
import { useSettings } from '../../services/settings.js'
import {
  addDraftFiles,
  clearDraft,
  EMPTY_DRAFT,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import type { UserMessage as UserMessageType } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { showToast } from '../base/toastState.js'
import { DraftAttachments } from '../chatInput/DraftAttachments.js'
import { hasDraggedFiles } from '../chatInput/DragMask.js'
import {
  BranchSwitcher,
  type MessageVersions,
  type SelectMessageVersion,
} from './BranchSwitcher.js'
import { MessageFile } from './MessageFile.js'
import { CopyButton } from './CopyButton.js'
import styles from './UserMessage.module.css'

export const UserMessage = memo(function UserMessage({
  sessionId,
  message,
  retryUploadId,
  isFirst,
  isLast,
  busy,
  versions,
  onSelectVersion,
  onEditingChange,
}: {
  sessionId: string
  message: UserMessageType
  /** 回答因补传附件失败可重试时为该回答 id */
  retryUploadId: string | null
  isFirst: boolean
  isLast: boolean
  busy: boolean
  versions: MessageVersions
  onSelectVersion: SelectMessageVersion
  onEditingChange: (id: string, editing: boolean) => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [attachmentDraft] = useState(() => Symbol())
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const attachments = useDrafts(
    (state) => state.drafts.get(attachmentDraft)?.attachments ?? EMPTY_DRAFT.attachments
  )
  const importing = useChatStore((state) => state.importingHistory)
  const editorDisabled = busy || importing
  const files = editing ? message.files.filter((file) => !removedIds.has(file.id)) : message.files
  const readyToSend = useUploads(
    (state) =>
      editing &&
      prepareDraftMessage({ text: draft, attachments }, state.tasks, files.length) !== null
  )
  const pickerRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()
  const canSend = !editorDisabled && readyToSend
  const changeEditing = (next: boolean) => {
    if (!next) {
      dragDepth.current = 0
      setDragging(false)
      clearDraft(attachmentDraft)
      setRemovedIds(new Set())
    }
    setEditing(next)
    onEditingChange(message.id, next)
  }
  useEffect(() => () => clearDraft(attachmentDraft), [attachmentDraft])

  const addFiles = (selected: File[]) => {
    if (selected.length === 0 || editorDisabled || !ensureApiKey()) {
      return
    }
    const error = addDraftFiles(
      attachmentDraft,
      selected,
      useSettings.getState().apiKey ?? '',
      files.length
    )
    if (error) {
      showToast(error)
    }
  }

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (editing && textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 202)}px`
    }
  }, [editing, draft])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (editing && textarea) {
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
      textarea.scrollTop = textarea.scrollHeight
    }
  }, [editing])

  const sendEdit = () => {
    if (
      canSend &&
      ensureApiKey() &&
      editMessage(sessionId, message.id, draft, removedIds, attachmentDraft)
    ) {
      stopReadAloud()
      changeEditing(false)
    }
  }

  const savedAttachments =
    files.length > 0
      ? files.map((file) => (
          <div key={file.id} className={styles.retainedFile}>
            <MessageFile
              file={file}
              onRetry={
                !editing && retryUploadId ? () => retryUpload(sessionId, retryUploadId) : null
              }
            />
            {editing && (
              <button
                type="button"
                className={styles.removeAttachment}
                aria-label={t(file.isImage ? 'removeImage' : 'removeAttachment', {
                  name: file.name,
                })}
                disabled={editorDisabled}
                onClick={() => setRemovedIds((current) => new Set([...current, file.id]))}
              >
                <IconCloseFill14 />
              </button>
            )}
          </div>
        ))
      : null

  return (
    <div className={clsx(styles.container, isFirst && styles.isFirst)}>
      {editing ? (
        <>
          {versions.ids.length > 1 && (
            <div className={styles.editorBranch}>
              <BranchSwitcher
                versions={versions}
                disabled={editorDisabled}
                onSelect={(id, anchorTop) => {
                  changeEditing(false)
                  onSelectVersion(id, anchorTop)
                }}
              />
            </div>
          )}
          <div
            className={styles.editor}
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
                event.dataTransfer.dropEffect = editorDisabled ? 'none' : 'copy'
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
              retained={savedAttachments}
              onRemove={(id) => removeDraftAttachment(attachmentDraft, id)}
              onRetry={(id) => {
                if (!editorDisabled && ensureApiKey()) {
                  retryDraftAttachment(attachmentDraft, id, useSettings.getState().apiKey ?? '')
                }
              }}
            />
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              aria-label={t('editMessage')}
              autoFocus
              rows={1}
              value={draft}
              disabled={editorDisabled}
              onChange={(event) => setDraft(event.target.value)}
              onPaste={(event) => {
                const pasted = Array.from(event.clipboardData.files)
                if (pasted.length > 0) {
                  event.preventDefault()
                  addFiles(pasted)
                }
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) {
                  return
                }
                if (event.key === 'Escape') {
                  changeEditing(false)
                } else if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !isMobile
                ) {
                  event.preventDefault()
                  sendEdit()
                }
              }}
            />
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
                disabled={editorDisabled}
                onClick={() => pickerRef.current?.click()}
              />
              <Button size="s" variant="outlined" onClick={() => changeEditing(false)}>
                {t('cancel')}
              </Button>
              <Button size="s" disabled={!canSend} onClick={sendEdit}>
                {t('send')}
              </Button>
            </div>
            {dragging && !editorDisabled && (
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
        </>
      ) : (
        <>
          {savedAttachments && (
            <div
              className={clsx(
                styles.files,
                files.some((file) => !file.isImage) && styles.filesWithDocuments
              )}
            >
              {savedAttachments}
            </div>
          )}
          {message.content ? <div className={styles.bubble}>{message.content}</div> : null}
          <div className={styles.bottom}>
            <div className={clsx(styles.actions, isLast && styles.alwaysShow)}>
              {message.content ? <CopyButton text={message.content} /> : null}
              <IconButton
                icon={<IconEditOutline16 />}
                tooltip={t('editMessage')}
                tooltipPlacement="bottom"
                disabled={busy}
                onClick={() => {
                  setDraft(message.content)
                  changeEditing(true)
                }}
              />
            </div>
            <BranchSwitcher versions={versions} disabled={busy} onSelect={onSelectVersion} />
          </div>
        </>
      )}
    </div>
  )
})
