import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { useIsMobile } from '../../app/viewport.js'
import { useSettings } from '../../services/settings.js'
import { buildMessageVersions, getVisibleMessages } from '../../services/chat/branches.js'
import { loadSession } from '../../services/chat/db.js'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import {
  IconChevronRightOutline14,
  IconCloseOutline16,
  IconConversationOutline20,
  IconHistorySearchOutline20,
} from '../base/icons.js'
import { closeAnimatedDialog } from '../base/playExit.js'
import { closeMobileSider } from './mobileSiderState.js'
import { useHistorySearch } from './historySearchState.js'
import './historySearch.css'

type Hit = {
  sessionId: string
  messageId: string
  title: string
  date: number
  before: string
  match: string
  after: string
  user: boolean
  version?: string
}

export function HistorySearch() {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const locale = useSettings((state) => state.locale)
  const formatDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const origin = useHistorySearch((state) => state.origin)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('done')
  const term = query.trim().toLowerCase()
  useLayoutEffect(() => {
    if (dialog.current && !dialog.current.open) {
      dialog.current.showModal()
    }
    const element = field.current
    if (!element || !origin || !isMobile) {
      return
    }
    const bounds = element.getBoundingClientRect()
    element.style.setProperty('--search-enter-x', `${origin.left - bounds.left}px`)
    element.style.setProperty('--search-enter-y', `${origin.top - bounds.top}px`)
    element.style.setProperty(
      '--search-enter-clip',
      `${Math.max(0, bounds.width - origin.width)}px`
    )
    element.dataset.searchExpand = ''
    return () => {
      delete element.dataset.searchExpand
    }
  }, [isMobile, origin])
  useEffect(() => {
    let cancelled = false
    setHits([])
    if (!term) {
      setStatus('done')
      return
    }
    setStatus('loading')
    const search = async () => {
      const found: Hit[] = []
      for (const summary of useChatStore.getState().sessions) {
        const session =
          useChatStore.getState().sessionCache[summary.id] ?? (await loadSession(summary.id))
        if (cancelled) {
          return
        }
        if (!session) {
          continue
        }
        const versions = buildMessageVersions(session, new Map())
        for (const message of getVisibleMessages(session).toReversed()) {
          const text = (
            message.role === 'user'
              ? [message.content, ...message.files.map((file) => file.name)].join(' ')
              : message.blocks
                  .flatMap((block) => (block.type === 'text' ? [block.text] : []))
                  .join(' ')
          ).replace(/\s+/g, ' ')
          const index = text.toLowerCase().indexOf(term)
          if (index < 0) {
            continue
          }
          const version = versions.get(message.id)
          found.push({
            sessionId: session.id,
            messageId: message.id,
            title: summary.title,
            date: message.createdAt,
            before: (index > 35 ? '…' : '') + text.slice(Math.max(0, index - 35), index),
            match: text.slice(index, index + term.length),
            after:
              text.slice(index + term.length, index + term.length + 90) +
              (text.length > index + term.length + 90 ? '…' : ''),
            user: message.role === 'user',
            version:
              version && version.ids.length > 1
                ? `${version.index + 1}/${version.ids.length}`
                : undefined,
          })
        }
      }
      if (!cancelled) {
        setHits(found)
        setStatus('done')
      }
    }
    const timer = setTimeout(
      () =>
        void search().catch(() => {
          if (!cancelled) {
            setStatus('error')
          }
        }),
      140
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term])

  const close = (onExit?: () => void) => {
    const element = dialog.current
    if (!element?.open || element.hasAttribute('data-exiting')) {
      return
    }
    const searchField = field.current
    if (searchField?.hasAttribute('data-search-expand')) {
      if (onExit) {
        delete searchField.dataset.searchExpand
      } else {
        const style = getComputedStyle(searchField)
        searchField.style.setProperty('--search-exit-clip', style.clipPath)
        searchField.style.setProperty('--search-exit-translate', style.translate)
      }
    }
    closeAnimatedDialog(element, onExit)
  }

  return (
    <dialog
      className="history-search"
      ref={dialog}
      aria-label={t('historySearch')}
      onClose={() => useHistorySearch.setState({ open: false, origin: null })}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="history-query">
        {isMobile && (
          <button
            className="history-close history-back"
            type="button"
            aria-label={t('close')}
            onClick={() => close()}
          >
            <IconChevronRightOutline14 />
          </button>
        )}
        <div ref={field} className="history-input">
          <IconHistorySearchOutline20 />
          <input
            ref={input}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('historySearchPlaceholder')}
            aria-label={t('historySearch')}
          />
          {isMobile && query && (
            <button
              className="history-close"
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => {
                setQuery('')
                input.current?.focus()
              }}
            >
              <IconCloseOutline16 />
            </button>
          )}
        </div>
        {!isMobile && (
          <button
            className="history-close"
            type="button"
            aria-label={t('close')}
            onClick={() => close()}
          >
            <IconCloseOutline16 />
          </button>
        )}
      </div>
      {term && (
        <div className="history-hits">
          {status === 'loading' ? (
            <div role="status" className="history-skeleton" aria-label={t('sessionLoading')} />
          ) : status === 'error' ? (
            <p role="alert">{t('sessionLoadFailed')}</p>
          ) : hits.length === 0 ? (
            <p role="status">{t('historyNoHits')}</p>
          ) : (
            hits.map((hit) => (
              <button
                type="button"
                key={hit.sessionId + '/' + hit.messageId}
                onClick={() =>
                  close(() => {
                    selectSession(hit.sessionId)
                    useHistorySearch.setState({
                      target: { sessionId: hit.sessionId, messageId: hit.messageId },
                    })
                    closeMobileSider()
                  })
                }
              >
                <span className="history-result-icon">
                  <IconConversationOutline20 />
                  {hit.user && (
                    <span
                      className="history-user-avatar"
                      role="img"
                      aria-label={t('userMessage')}
                    />
                  )}
                </span>
                <span className="history-result-content">
                  <span className="history-result-title">
                    <strong>{hit.title || t('untitledChat')}</strong>
                    <time dateTime={new Date(hit.date).toISOString()}>
                      {formatDate.format(hit.date)}
                    </time>
                  </span>
                  <span className="history-snippet">
                    {hit.version && <span className="history-version">{hit.version}</span>}
                    {hit.before}
                    <mark>{hit.match}</mark>
                    {hit.after}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </dialog>
  )
}
