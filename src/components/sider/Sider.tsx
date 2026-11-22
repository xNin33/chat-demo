import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCloseOutline16,
  IconMultiSelectOutline16,
  IconPanelLeftOutline16,
  IconPinOutline16,
  IconSearchOutline16,
  IconSettingsOutline16,
  IconTrashOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { openHistorySearch } from './historySearchState.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import {
  newChat,
  removeSession,
  setSessionsPinned,
  useChatStore,
} from '../../services/chat/store.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

const SESSION_BATCH_SIZE = 40

/** 展开的侧边栏：名称与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const groups = useMemo(() => groupSessions(sessions, now, t), [sessions, now, t])
  const [visibleCount, setVisibleCount] = useState(SESSION_BATCH_SIZE)
  const listRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const hasMore = visibleCount < sessions.length
  const visibleGroups = useMemo(() => {
    const visible: typeof groups = []
    let remaining = visibleCount
    for (const group of groups) {
      if (remaining <= 0) {
        break
      }
      visible.push(
        remaining >= group.sessions.length
          ? group
          : { ...group, sessions: group.sessions.slice(0, remaining) }
      )
      remaining -= group.sessions.length
    }
    return visible
  }, [groups, visibleCount])
  const importing = useChatStore((state) => state.importingHistory)
  const [selection, setSelection] = useState<Set<string> | null>(null)
  const [deleting, setDeleting] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const selected = selection ? sessions.filter((session) => selection.has(session.id)) : []
  const count = selected.length
  const allPinned = count > 0 && selected.every((session) => session.pinned)
  const actionsDisabled = busy || importing || count === 0

  const pinSelected = async () => {
    setBusy(true)
    try {
      if (await setSessionsPinned(new Set(selected.map((session) => session.id)), !allPinned)) {
        setSelection(null)
      } else {
        showToast({ key: 'pinSessionsFailed', type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async (ids: string[]) => {
    setBusy(true)
    try {
      const results = await Promise.all(ids.map(removeSession))
      const remaining = ids.filter((_, index) => !results[index])
      setDeleting(remaining.length && ids.length === 1 ? remaining : null)
      if (remaining.length) {
        setSelection((current) => current && new Set(remaining))
        showToast({
          key: ids.length === 1 ? 'sessionDeleteFailed' : 'batchDeleteFailed',
          type: 'error',
        })
      } else {
        setSelection(null)
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const root = listRef.current
    const target = loadMoreRef.current
    if (!hasMore || !root || !target) {
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          setVisibleCount((count) => count + SESSION_BATCH_SIZE)
        }
      },
      { root, rootMargin: '0px 0px 160px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, visibleCount])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div
      className={clsx(styles.sider, mobile && styles.mobile)}
      onKeyDown={(event) => {
        if (selection && !deleting && !busy && event.key === 'Escape') {
          event.stopPropagation()
          setSelection(null)
        }
      }}
    >
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        {!selection && (
          <IconButton
            icon={<IconSearchOutline16 />}
            tooltip={t('historySearch')}
            onClick={openHistorySearch}
          />
        )}
        <div className={mobile ? undefined : styles.desktopToggle}>
          <IconButton
            size="m"
            icon={<IconPanelLeftOutline16 />}
            tooltip={t('collapseSiderbarButton')}
            tooltipPlacement="bottom"
            disabled={busy}
            onClick={() => {
              setSelection(null)
              if (mobile) {
                closeMobileSider()
              } else {
                setSiderCollapsed(true)
              }
            }}
          />
        </div>
      </div>
      {selection ? (
        <div className={styles.selectionHeader}>
          <span aria-live="polite">
            {count ? t('sessionsSelected', { count }) : t('selectSessions')}
          </span>
          <IconButton
            icon={<IconCloseOutline16 />}
            aria-label={t('cancel')}
            disabled={busy}
            onClick={() => setSelection(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.newChat}
          aria-keyshortcuts={mobile ? undefined : 'Control+J'}
          onClick={() => {
            newChat()
            closeMobileSider()
          }}
        >
          <span className={styles.newChatIcon}>
            <NewChatIcon />
          </span>
          {t('newChat')}
          {!mobile && <span className={styles.newChatShortcut} aria-hidden="true">Ctrl + J</span>}
        </button>
      )}
      <div className={styles.listWrap}>
        <div ref={listRef} className={styles.list}>
          {!selection && sessions.length > 0 && (
            <div className={styles.listTools}>
              <IconButton
                icon={<IconMultiSelectOutline16 />}
                tooltip={t('multiSelectSessions')}
                disabled={importing}
                onClick={() => setSelection(new Set())}
              />
            </div>
          )}
          {visibleGroups.map((group) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>{group.label}</div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  onDelete={() => setDeleting([session.id])}
                  selection={
                    selection
                      ? {
                          checked: selection.has(session.id),
                          disabled: busy || importing,
                          toggle: () =>
                            setSelection((current) => {
                              const next = new Set(current)
                              if (next.has(session.id)) {
                                next.delete(session.id)
                              } else {
                                next.add(session.id)
                              }
                              return next
                            }),
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
          {hasMore && <div ref={loadMoreRef} className={styles.loadMore} aria-hidden="true" />}
        </div>
      </div>
      {selection ? (
        <div className={styles.batchActions}>
          <button type="button" disabled={actionsDisabled} onClick={() => void pinSelected()}>
            <IconPinOutline16 /> {t(allPinned ? 'unpinSessions' : 'pinSessions')}
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => setDeleting(selected.map((session) => session.id))}
          >
            <IconTrashOutline16 /> {t('delete')}
          </button>
        </div>
      ) : (
        <div className={styles.bottom}>
          <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
            <span className={styles.settingsIcon}>
              <IconSettingsOutline16 />
            </span>
            <span className={styles.settingsLabel}>{t('settings')}</span>
          </button>
        </div>
      )}
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!busy) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={busy} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={busy || importing}
                onClick={() => void confirmDelete(deleting)}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {deleting.length === 1
            ? t('deleteSessionWithFilesDescription')
            : t('deleteSelectedSessionsDescription', { count: deleting.length })}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
