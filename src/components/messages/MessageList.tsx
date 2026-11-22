import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { IconChevronDownOutline14 } from '../base/icons.js'
import {
  buildMessageVersions,
  getVisibleMessages,
  type MessageVersions,
} from '../../services/chat/branches.js'
import { selectMessageVersion } from '../../services/chat/store.js'
import type { Message, Session, UserMessage as Prompt } from '../../services/chat/types.js'
import { closeSearchPanel } from '../search/searchPanelState.js'
import { AssistantMessage } from './AssistantMessage.js'
import { UserMessage } from './UserMessage.js'
import { useHistorySearch } from '../sider/historySearchState.js'
import styles from './MessageList.module.css'

/**
 * 会话共用可重试的附件上传失败入口，覆盖当前提问与历史消息中的附件。
 * 点击后按失败的回答重新补传附件并请求。
 */
const getUploadRetryId = (messages: Message[], streaming: boolean) => {
  const last = messages.at(-1)
  return !streaming &&
    last?.role === 'assistant' &&
    last.status === 'error' &&
    last.error?.kind === 'upload' &&
    last.error.retryable
    ? last.id
    : null
}
/** 距底部小于该值时视为在底部，流式内容增长时跟随 */
const STICKY_THRESHOLD = 4
const EMPTY_VERSIONS: MessageVersions = { ids: [], index: -1 }
const scrollBehavior = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'

export const MessageList = ({
  session,
  streaming,
  footer,
}: {
  session: Session
  streaming: boolean
  footer: React.ReactNode
}) => {
  const isMobile = useIsMobile()
  const t = useTranslate()
  const [atEnd, setAtEnd] = useState(true)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [activePrompt, setActivePrompt] = useState<string>()
  const [jumpHighlight, setJumpHighlight] = useState<{ id: string; key: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const restoreScrollRef = useRef<{ messageId: string; top: number } | null>(null)
  const lastPromptRef = useRef<string>()
  const searchTarget = useHistorySearch(state => state.target)
  const [focusedMessageId, setFocusedMessageId] = useState<string>()
  const [editingIds, setEditingIds] = useState<ReadonlySet<string>>(() => new Set())
  const { messages, prompts, indices, promptIdsByRow } = useMemo(() => {
    const messages = getVisibleMessages(session)
    const prompts: { message: Prompt; row: number }[] = []
    const indices = new Map<string, number>()
    let promptId: string | undefined
    const promptIdsByRow = messages.map((message, row) => {
      indices.set(message.id, row)
      if (message.role === 'user') {
        promptId = message.id
        prompts.push({ message, row })
      }
      return promptId
    })
    return { messages, prompts, indices, promptIdsByRow }
  }, [session])
  const [previousVersions, setPreviousVersions] = useState(() =>
    buildMessageVersions(session, new Map())
  )
  const versions = useMemo(
    () => buildMessageVersions(session, previousVersions),
    [session, previousVersions]
  )
  if (versions !== previousVersions) {
    setPreviousVersions(versions)
  }
  const lastMessageId = messages.at(-1)?.id
  const lastPromptId = prompts.at(-1)?.message.id
  const showRail = !isMobile && hasOverflow && prompts.length > 1
  const anchorId = restoreScrollRef.current?.messageId
  const rangeExtractor = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) => {
      const rows = new Set(defaultRangeExtractor(range))
      // 保留正在编辑或持有焦点的行，并让切换后的版本选择器可立即定位。
      for (const id of [...editingIds, focusedMessageId, anchorId]) {
        const row = id === undefined ? undefined : indices.get(id)
        if (row !== undefined) {
          rows.add(row)
        }
      }
      return [...rows].sort((a, b) => a - b)
    },
    [anchorId, editingIds, focusedMessageId, indices]
  )
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: useCallback((index: number) => messages[index].id, [messages]),
    estimateSize: (index) => (messages[index].role === 'user' ? 112 : 280),
    rangeExtractor,
    overscan: 5,
    paddingEnd: 24,
    scrollPaddingStart: 16,
    anchorTo: 'end',
    followOnAppend: !anchorId,
    scrollEndThreshold: STICKY_THRESHOLD,
  })
  const totalSize = virtualizer.getTotalSize()
  const rows = virtualizer.getVirtualItems()

  const syncScrollState = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) {
      return
    }
    const overflow = scroll.scrollHeight - scroll.clientHeight
    const nearEnd = overflow - scroll.scrollTop <= STICKY_THRESHOLD
    setHasOverflow(overflow > STICKY_THRESHOLD)
    setAtEnd(nearEnd)
    if (!isMobile) {
      const offset = scroll.scrollTop + Math.min(80, scroll.clientHeight / 4)
      const row = virtualizer.getVirtualItemForOffset(offset)?.index ?? 0
      setActivePrompt(nearEnd ? lastPromptId : promptIdsByRow[row])
    }
  }, [isMobile, lastPromptId, promptIdsByRow, virtualizer])

  // 切换版本后将选择器留在原位置，避免回答长短变化导致操作区跳出视口。
  useLayoutEffect(() => {
    const anchor = restoreScrollRef.current
    const scroll = scrollRef.current
    const newPrompt = lastPromptRef.current !== lastPromptId
    lastPromptRef.current = lastPromptId
    if (anchor && scroll) {
      const switcher = scroll.querySelector<HTMLElement>(
        `[data-message-version="${CSS.escape(anchor.messageId)}"]`
      )
      if (switcher) {
        virtualizer.scrollToOffset(
          scroll.scrollTop + switcher.getBoundingClientRect().top - anchor.top,
          { align: 'start', behavior: 'instant' }
        )
        restoreScrollRef.current = null
      } else if (!indices.has(anchor.messageId)) {
        restoreScrollRef.current = null
      }
      return
    }
    if (newPrompt) {
      virtualizer.scrollToEnd({ behavior: 'instant' })
    }
  }, [indices, lastPromptId, rows, virtualizer])

  useLayoutEffect(() => {
    syncScrollState()
  }, [syncScrollState, totalSize])

  // 输入框或移动端键盘改变可视高度时，仅在原来位于底部的情况下继续吸底。
  useLayoutEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) {
      return
    }
    let previousHeight = scroll.clientHeight
    const observer = new ResizeObserver(() => {
      const height = scroll.clientHeight
      const remaining = scroll.scrollHeight - scroll.scrollTop
      if (height < previousHeight && remaining - previousHeight <= STICKY_THRESHOLD) {
        virtualizer.scrollToEnd({ behavior: 'instant' })
      }
      previousHeight = height
      setAtEnd(scroll.scrollHeight - scroll.scrollTop - height <= STICKY_THRESHOLD)
      setHasOverflow(scroll.scrollHeight - height > STICKY_THRESHOLD)
    })
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [virtualizer])

  useLayoutEffect(() => {
    const rail = railRef.current
    const active = rail?.querySelector<HTMLElement>('button[aria-current]')
    if (!rail || !active) {
      return
    }
    const revealActive = () => {
      const railBounds = rail.getBoundingClientRect()
      const activeBounds = active.getBoundingClientRect()
      if (activeBounds.top < railBounds.top || activeBounds.bottom > railBounds.bottom) {
        rail.scrollTop +=
          activeBounds.top - railBounds.top - (rail.clientHeight - active.clientHeight) / 2
      }
    }
    revealActive()
    const observer = new ResizeObserver(revealActive)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [activePrompt, showRail])

  useEffect(closeSearchPanel, [session.id, lastMessageId])

  useEffect(() => {
    if (!jumpHighlight) {
      return
    }
    const timer = setTimeout(() => setJumpHighlight(null), 850)
    return () => clearTimeout(timer)
  }, [jumpHighlight])

  const selectVersion = useCallback(
    (messageId: string, anchorTop: number) => {
      if (streaming) {
        return
      }
      restoreScrollRef.current = { messageId, top: anchorTop }
      closeSearchPanel()
      selectMessageVersion(session.id, messageId)
    },
    [session.id, streaming]
  )

  useLayoutEffect(() => {
    if (searchTarget?.sessionId !== session.id) {return}
    const index = indices.get(searchTarget.messageId)
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: 'start', behavior: 'instant' })
    }
    useHistorySearch.setState({ target: null })
  }, [indices, searchTarget, session.id, virtualizer])

  const trackEditing = useCallback((id: string, editing: boolean) => {
    setEditingIds((current) => {
      const next = new Set(current)
      if (editing) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const lastIndex = messages.length - 1
  const uploadRetryId = getUploadRetryId(messages, streaming)
  return (
    <>
      <div className={styles.container}>
        <div
          ref={scrollRef}
          className={styles.scroll}
          data-motion="fade"
          tabIndex={0}
          onScroll={syncScrollState}
          onWheel={() => virtualizer.cancelScroll()}
          onPointerDown={() => virtualizer.cancelScroll()}
          onTouchStart={() => virtualizer.cancelScroll()}
          onKeyDown={(event) => {
            if (
              ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key) &&
              !(event.target as HTMLElement).closest(
                'input, textarea, select, [contenteditable="true"]'
              )
            ) {
              virtualizer.cancelScroll()
            }
          }}
        >
          <div className={styles.column} style={{ height: totalSize }}>
            {rows.map(({ key, index, start }) => {
              const message = messages[index]
              return (
                <div
                  key={key}
                  ref={virtualizer.measureElement}
                  className={styles.row}
                  data-index={index}
                  style={{ top: start }}
                  onFocusCapture={() => setFocusedMessageId(message.id)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setFocusedMessageId((id) => (id === message.id ? undefined : id))
                    }
                  }}
                >
                  {jumpHighlight?.id === message.id && (
                    <span key={jumpHighlight.key} className={styles.jumpHighlight} aria-hidden="true" />
                  )}
                  {message.role === 'user' ? (
                    <UserMessage
                      sessionId={session.id}
                      message={message}
                      retryUploadId={uploadRetryId}
                      isFirst={index === 0}
                      isLast={index === lastIndex || index === lastIndex - 1}
                      busy={streaming}
                      versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                      onSelectVersion={selectVersion}
                      onEditingChange={trackEditing}
                    />
                  ) : (
                    <AssistantMessage
                      sessionId={session.id}
                      message={message}
                      isLast={index === lastIndex}
                      streaming={streaming && index === lastIndex}
                      busy={streaming}
                      versions={versions.get(message.id) ?? EMPTY_VERSIONS}
                      onSelectVersion={selectVersion}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.footer}>
          {!atEnd ? (
            <button
              type="button"
              className={styles.bottomButton}
              data-motion="enter"
              aria-label={t('scrollToBottom')}
              title={t('scrollToBottom')}
              onClick={() => virtualizer.scrollToEnd({ behavior: scrollBehavior() })}
            >
              <IconChevronDownOutline14 />
            </button>
          ) : null}
          {footer}
        </div>
      </div>
      {showRail && (
        <nav className={styles.rail} aria-label={t('messageNavigation')}>
          <div ref={railRef} className={styles.railScroll}>
            {prompts.map(({ message: prompt, row }, index) => {
              const label =
                prompt.content.trim().replace(/\s+/g, ' ') ||
                prompt.files.map((file) => file.name).join(', ') ||
                String(index + 1)
              const branch = versions.get(prompt.id) ?? EMPTY_VERSIONS
              const current = branch.index + 1
              const total = branch.ids.length
              const version = total > 1 ? `${current}/${total}` : null
              return (
                <button
                  key={prompt.id}
                  type="button"
                  title={version ? `${label}\n${t('versionPosition', { current, total })}` : label}
                  aria-current={activePrompt === prompt.id ? 'location' : undefined}
                  onClick={() => {
                    virtualizer.scrollToIndex(row, { align: 'start', behavior: 'instant' })
                    setJumpHighlight((current) => ({ id: prompt.id, key: (current?.key ?? 0) + 1 }))
                  }}
                >
                  <span className={styles.railDetails}>
                    {version && <span className={styles.railVersion}>{version}</span>}
                    <span className={styles.railLabel}>{label}</span>
                  </span>
                  <span className={styles.railMark} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
