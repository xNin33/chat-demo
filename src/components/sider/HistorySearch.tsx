import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { getVisibleMessages } from '../../services/chat/branches.js'
import { loadSession } from '../../services/chat/db.js'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import { IconSearchOutline16 } from '../base/icons.js'
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
}

export function HistorySearch() {
  const t = useTranslate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('done')
  const term = query.trim().toLowerCase()
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
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
          found.push({
            sessionId: session.id,
            messageId: message.id,
            title: summary.title,
            date: message.createdAt,
            before: (index > 35 ? '…' : '') + text.slice(Math.max(0, index - 35), index),
            match: text.slice(index, index + term.length),
            after: text.slice(index + term.length, index + term.length + 90),
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

  return (
    <dialog
      className="history-search"
      ref={dialog}
      aria-label={t('historySearch')}
      onClose={() => useHistorySearch.setState({ open: false })}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialog.current?.close()
        }
      }}
    >
      <div className="history-query">
        <IconSearchOutline16 />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('historySearch')}
          aria-label={t('historySearch')}
        />
        <button type="button" aria-label={t('close')} onClick={() => dialog.current?.close()}>
          ×
        </button>
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
                onClick={() => {
                  selectSession(hit.sessionId)
                  useHistorySearch.setState({
                    target: { sessionId: hit.sessionId, messageId: hit.messageId },
                  })
                  closeMobileSider()
                  dialog.current?.close()
                }}
              >
                <strong>{hit.title || t('untitledChat')}</strong>
                <time>{new Date(hit.date).toLocaleDateString(document.documentElement.lang)}</time>
                <span>
                  {hit.before}
                  <mark>{hit.match}</mark>
                  {hit.after}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </dialog>
  )
}
