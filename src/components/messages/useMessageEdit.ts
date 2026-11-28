import { useEffect, useState } from 'react'
import { useUploads } from '../../services/attachments.js'
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
import { showToast } from '../base/toastState.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'

type EditState = { id: string; text: string; removed: ReadonlySet<string>; key: symbol }

/**
 * 编辑提问的草稿：文字、保留的原附件与新附件。message 为 null 时不在编辑。
 * 新附件放在独立的草稿里，不影响输入框原有的草稿；换一条消息或结束编辑时清理。
 */
export const useMessageEdit = (
  sessionId: string | null,
  message: UserMessage | null,
  busy: boolean
) => {
  const [state, setState] = useState<EditState | null>(null)
  let edit = state
  if ((message?.id ?? null) !== (state?.id ?? null)) {
    edit = message
      ? { id: message.id, text: message.content, removed: new Set(), key: Symbol() }
      : null
    setState(edit)
  }
  const key = edit?.key
  useEffect(
    () => () => {
      if (key) {
        clearDraft(key)
      }
    },
    [key]
  )

  const attachments = useDrafts((drafts) =>
    key ? (drafts.drafts.get(key)?.attachments ?? EMPTY_DRAFT.attachments) : EMPTY_DRAFT.attachments
  )
  const importing = useChatStore((chat) => chat.importingHistory)
  const disabled = busy || importing
  const files = message && edit ? message.files.filter((file) => !edit.removed.has(file.id)) : []
  const text = edit?.text ?? ''
  const ready = useUploads(
    (uploads) =>
      edit !== null &&
      prepareDraftMessage({ text, attachments }, uploads.tasks, files.length) !== null
  )

  return {
    active: edit !== null && message !== null,
    text,
    files,
    attachments,
    disabled,
    ready: ready && !disabled,
    setText: (value: string) => setState((current) => current && { ...current, text: value }),
    removeFile: (id: string) =>
      setState((current) => current && { ...current, removed: new Set([...current.removed, id]) }),
    addFiles: (selected: File[]) => {
      if (!key || !selected.length || disabled || !ensureApiKey()) {
        return
      }
      const error = addDraftFiles(key, selected, files.length)
      if (error) {
        showToast(error)
      }
    },
    removeAttachment: (id: string) => {
      if (key) {
        removeDraftAttachment(key, id)
      }
    },
    retryAttachment: (id: string) => {
      if (key && !disabled && ensureApiKey()) {
        retryDraftAttachment(key, id)
      }
    },
    /** 提交成功返回 true，调用方随后收起编辑 */
    submit: () => {
      if (!edit || !message || sessionId === null || disabled || !ready || !ensureApiKey()) {
        return false
      }
      if (!editMessage(sessionId, message.id, edit.text, edit.removed, edit.key)) {
        return false
      }
      stopReadAloud()
      return true
    },
  }
}
