import clsx from 'clsx'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  IconAttachPlus20,
  IconCloseFill14,
  IconCloseOutline16,
  IconPaperclipOutline16,
  IconSendOutline16,
  IconStopFill16,
} from '../base/icons.js'
import { useIsMobile } from '../../app/viewport.js'
import { sendMessage, stopReply, useChatStore } from '../../services/chat/store.js'
import {
  addDraftFiles,
  EMPTY_DRAFT,
  getDraft,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  setDraftText,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { IconButton } from '../base/IconButton.js'
import { ensureApiKey, ensureDeepSeekKey } from '../settings/settingsDialogState.js'
import { DragMask, useFileDrop } from './DragMask.js'
import { showToast } from '../base/toastState.js'
import { ACCEPT, isPreviewImage, useUploads } from '../../services/attachments.js'
import { DraftAttachments } from './DraftAttachments.js'
import { ChatToggles } from './ChatToggles.js'
import { MobileAttachmentPicker } from './MobileAttachmentPicker.js'
import type { ActiveMessageComposer, CloseMessageComposer } from './messageComposer.js'
import { useVoiceInput } from './useVoiceInput.js'
import { VoiceButton } from './VoiceButton.js'
import { Spectrum } from './Spectrum.js'
import { MessageFile } from '../messages/MessageFile.js'
import { useMessageEdit } from '../messages/useMessageEdit.js'
import { useTranslate } from '../../i18n/index.js'
import styles from './ChatInput.module.css'
import messageStyles from '../messages/UserMessage.module.css'

type InputProps = {
  sessionId: string | null
  composerRef?: RefObject<HTMLDivElement>
  /** 移动端「编辑」「选择文本」：输入框原地向上展开，复用同一个输入框 */
  messageComposer?: ActiveMessageComposer | null
  onCloseMessageComposer?: CloseMessageComposer
}

/** 输入框：自适应高度的文本框 + 文件 + 深度思考与智能搜索开关 + 语音输入 + 发送 / 停止 */
export const ChatInput = memo(function ChatInput(props: InputProps) {
  // 切换目标时释放录音、转写和 DOM 状态；文字与附件由草稿服务保留。
  return <Input key={props.sessionId === null ? 'new' : `session:${props.sessionId}`} {...props} />
})

const Input = ({ sessionId, composerRef, messageComposer, onCloseMessageComposer }: InputProps) => {
  const t = useTranslate()
  const draft = useDrafts((state) => state.drafts.get(sessionId) ?? EMPTY_DRAFT)
  const draftReady = useUploads((state) => prepareDraftMessage(draft, state.tasks) !== null)
  const streaming = useChatStore(
    (state) => sessionId !== null && Object.hasOwn(state.streaming, sessionId)
  )
  const importingHistory = useChatStore((state) => state.importingHistory)
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachmentOpen, setAttachmentOpen] = useState(false)

  const panel = messageComposer?.panel ?? null
  const edit = useMessageEdit(sessionId, panel?.kind === 'edit' ? panel.message : null, streaming)
  const editing = panel?.kind === 'edit' && edit.active
  const selecting = panel?.kind === 'text'
  const close = () => onCloseMessageComposer?.()

  // 编辑时同一个文本框改为编辑提问的文字与附件，收起后回到原草稿。
  const text = editing ? edit.text : draft.text
  const setText = (value: string) =>
    editing ? edit.setText(value) : setDraftText(sessionId, value)

  const acceptFiles = (files: File[]) => {
    if (selecting || files.length === 0 || useChatStore.getState().importingHistory) {
      return
    }
    if (editing) {
      edit.addFiles(files)
      return
    }
    if (!ensureApiKey()) {
      return
    }
    const error = addDraftFiles(sessionId, files)
    if (error) {
      showToast(error)
    }
  }
  const retryFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory && ensureApiKey()) {
        retryDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const removeFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory) {
        removeDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const dragging = useFileDrop(acceptFiles)

  /** 转写结果插入到光标处，并把光标移到插入内容之后 */
  const voice = useVoiceInput((transcript) => {
    const textarea = textareaRef.current
    const current = editing ? edit.text : getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    setText(current.slice(0, start) + transcript + current.slice(end))
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      textarea?.setSelectionRange(start + transcript.length, start + transcript.length)
    })
  })

  // 欢迎页导入后会话 ID 不变，不能依赖卸载取消语音；订阅开始事件也覆盖快速完成的导入。
  const cancelVoice = voice.cancel
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.importingHistory && !previous.importingHistory) {
          cancelVoice()
          setAttachmentOpen(false)
        }
      }),
    [cancelVoice]
  )

  // 展开或收起时结束录音、收起附件面板；进入编辑时把光标放到文字末尾。
  const panelKey = panel ? (panel.kind === 'edit' ? `edit:${panel.message.id}` : 'text') : null
  useLayoutEffect(() => {
    setAttachmentOpen(false)
    cancelVoice()
    const textarea = textareaRef.current
    if (panelKey?.startsWith('edit:') && textarea) {
      textarea.focus({ preventScroll: true })
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
      textarea.scrollTop = textarea.scrollHeight
    }
  }, [cancelVoice, panelKey])

  // 移动端录音时用频谱替代输入框内容
  const recording = voice.status === 'recording'

  // 排队、上传中或上传失败的附件都留在输入框，全部上传成功后才能发送
  const canSend =
    !importingHistory &&
    voice.status === 'idle' &&
    (editing ? edit.ready : !panel && !streaming && draftReady)

  const send = () => {
    if (useChatStore.getState().importingHistory || voice.status !== 'idle' || selecting) {
      return
    }
    if (editing) {
      if (edit.submit()) {
        close()
      }
      return
    }
    if (panel || !prepareDraftMessage(getDraft(sessionId), useUploads.getState().tasks)) {
      return
    }
    // 文本与上传完成态由提交动作读取最新快照，不使用上一次渲染的草稿。
    if (!ensureApiKey() || !sendMessage(sessionId)) {
      return
    }
    stopReadAloud()
    setAttachmentOpen(false)
    if (isMobile) {
      textareaRef.current?.blur()
    } else {
      textareaRef.current?.focus()
    }
  }

  const attachments = editing ? (
    <DraftAttachments
      items={edit.attachments}
      retained={
        edit.files.length
          ? edit.files.map((file) => (
              <div key={file.id} className={messageStyles.retainedFile}>
                <MessageFile file={file} onRetry={null} />
                <button
                  type="button"
                  className={messageStyles.removeAttachment}
                  aria-label={t(isPreviewImage(file.name) ? 'removeImage' : 'removeAttachment', {
                    name: file.name,
                  })}
                  disabled={edit.disabled}
                  onClick={() => edit.removeFile(file.id)}
                >
                  <IconCloseFill14 />
                </button>
              </div>
            ))
          : null
      }
      onRetry={edit.retryAttachment}
      onRemove={edit.removeAttachment}
    />
  ) : (
    <DraftAttachments items={draft.attachments} onRetry={retryFile} onRemove={removeFile} />
  )

  return (
    <>
      <div
        ref={composerRef}
        className={clsx(styles.wrapper, sessionId === null ? styles.home : styles.session)}
        data-message-composer={panel?.kind}
        onClick={(event) => {
          if (!panel && event.target === event.currentTarget) {
            textareaRef.current?.focus({ preventScroll: true })
          }
        }}
        onKeyDown={(event) => {
          if (
            panel &&
            event.key === 'Escape' &&
            !event.nativeEvent.isComposing &&
            !(event.target as HTMLElement).closest('dialog[open]')
          ) {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
      >
        {/* 标题栏只在编辑和选择文本期间存在；点击收起时随模式一起立即移除，不等收起动画。 */}
        {panel && (
          <header className={styles.islandHeader}>
            {panel.kind === 'text' && <span className={styles.grabber} aria-hidden />}
            <span className={styles.islandTitle}>
              {t(panel.kind === 'edit' ? 'editMessageInput' : 'selectMessageText')}
            </span>
            <IconButton
              icon={<IconCloseOutline16 />}
              tone="primary"
              aria-label={t('close')}
              onClick={close}
            />
          </header>
        )}
        {/* 选择文本只展示可选择的消息原文；编辑复用同一个文本框，只替换其中的内容。 */}
        {panel?.kind === 'text' ? (
          <div className={styles.selectableMessage} data-selectable-message-text>
            {panel.text}
          </div>
        ) : (
          <>
            {attachments}
            <div className={styles.textareaWrapper}>
              <textarea
                ref={textareaRef}
                className={clsx(styles.textarea, recording && isMobile && styles.textareaHidden)}
                placeholder={t(editing ? 'editMessage' : 'chatInputPlaceholderChat')}
                aria-label={editing ? t('editMessage') : undefined}
                rows={2}
                // 移动端不自动聚焦，避免一打开就弹出键盘
                autoFocus={!isMobile}
                disabled={importingHistory || (editing && edit.disabled)}
                value={text}
                onChange={(event) => setText(event.target.value)}
                // 键盘弹出时收起附件面板，给消息列表留出空间。
                onFocus={() => setAttachmentOpen(false)}
                onMouseDown={(event) => {
                  // 首次点击时手动聚焦，避免 Safari 把整个页面滚到输入框位置。
                  if (
                    isMobile &&
                    event.button === 0 &&
                    document.activeElement !== event.currentTarget
                  ) {
                    event.preventDefault()
                    event.currentTarget.focus({ preventScroll: true })
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    send()
                  }
                }}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files)
                  if (files.length > 0) {
                    event.preventDefault()
                    acceptFiles(files)
                  }
                }}
              />
              {recording && isMobile ? <Spectrum getAnalyser={voice.getAnalyser} /> : null}
              <div className={styles.mirror} aria-hidden>
                {`${text}\n`}
              </div>
            </div>
            {/* 编辑时底部功能栏保留，展开收起时位置不变。 */}
            <div className={styles.functionRow} data-island-keep>
              <ChatToggles allowSettings={!panel} />
              <div className={styles.right}>
                <>
                  <VoiceButton
                    status={voice.status}
                    disabled={!voice.available}
                    seconds={voice.seconds}
                    onClick={() => {
                      if (
                        voice.status !== 'idle' ||
                        (!useChatStore.getState().importingHistory && ensureDeepSeekKey())
                      ) {
                        void voice.toggle()
                      }
                    }}
                  />
                  {isMobile ? (
                    <IconButton
                      size="m"
                      tone="primary"
                      icon={<IconAttachPlus20 />}
                      className="attachment-plus"
                      aria-label={t(attachmentOpen ? 'attachmentCloseTray' : 'attachmentOpenTray')}
                      aria-expanded={attachmentOpen}
                      disabled={importingHistory || (editing && edit.disabled)}
                      onClick={() => {
                        // 先确认 API Key，避免拍照或选完照片后才被设置弹窗打断。
                        if (!attachmentOpen && !ensureApiKey()) {
                          return
                        }
                        textareaRef.current?.blur()
                        setAttachmentOpen((open) => !open)
                      }}
                    />
                  ) : (
                    <IconButton
                      size="m"
                      tone="primary"
                      icon={<IconPaperclipOutline16 />}
                      tooltip={t('uploadFile')}
                      disabled={importingHistory}
                      onClick={() => ensureApiKey() && fileInputRef.current?.click()}
                    />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    accept={ACCEPT}
                    onChange={(event) => {
                      acceptFiles(Array.from(event.target.files ?? []))
                      event.target.value = ''
                    }}
                  />
                  {streaming && sessionId && !editing ? (
                    <button
                      type="button"
                      className={styles.sendButton}
                      aria-label={t('chatInputStopButtonTooltip')}
                      onClick={() => {
                        stopReadAloud()
                        stopReply(sessionId)
                      }}
                    >
                      <IconStopFill16 />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={clsx(styles.sendButton, !canSend && styles.disabled)}
                      aria-label={t('send')}
                      aria-disabled={!canSend}
                      onClick={send}
                    >
                      <IconSendOutline16 />
                    </button>
                  )}
                </>
              </div>
            </div>
          </>
        )}
        {dragging && !selecting ? <DragMask /> : null}
      </div>
      {isMobile && !importingHistory && !selecting && (
        <MobileAttachmentPicker
          open={attachmentOpen}
          close={() => setAttachmentOpen(false)}
          onFiles={acceptFiles}
        />
      )}
    </>
  )
}
