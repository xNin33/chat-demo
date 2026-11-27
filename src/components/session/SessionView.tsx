import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import type { Session } from '../../services/chat/types.js'
import { renameSession, useChatStore } from '../../services/chat/store.js'
import { playExit } from '../base/playExit.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import {
  OpenMessageComposer,
  type ActiveMessageComposer,
  type CloseMessageComposer,
  type MessageComposer,
} from '../chatInput/messageComposer.js'
import { MessageList } from '../messages/MessageList.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './SessionView.module.css'

/** 会话页：标题栏（移动端为顶栏）+ 消息列表，输入框吸底 */
export const SessionView = ({
  session,
  streaming,
  siderCollapsed,
}: {
  session: Session
  streaming: boolean
  siderCollapsed: boolean
}) => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const importing = useChatStore((state) => state.importingHistory)
  const composerRef = useRef<HTMLDivElement>(null)
  const [messageComposer, setMessageComposer] = useState<ActiveMessageComposer | null>(null)
  const activeComposer = isMobile && !importing ? messageComposer : null

  const openMessageComposer = useCallback((panel: MessageComposer) => {
    const composer = composerRef.current
    if (!composer || composer.hasAttribute('data-exiting')) {
      return
    }
    const fromHeight = composer.offsetHeight
    setMessageComposer((current) => ({
      panel,
      fromHeight,
      draftHeight: current?.draftHeight ?? fromHeight,
    }))
  }, [])
  useEffect(() => {
    if (!isMobile || importing) {
      setMessageComposer(null)
    }
  }, [isMobile, importing])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!activeComposer || !composer) {
      return
    }
    composer.style.setProperty('--composer-draft-height', `${activeComposer.draftHeight}px`)
    // 输入区只布局一次，抽屉的外壳和内容一起平移。
    composer.style.setProperty(
      '--composer-entry-offset',
      `${Math.max(0, composer.offsetHeight - activeComposer.fromHeight)}px`
    )
    composer.dataset.composerEntering = ''
    return () => {
      delete composer.dataset.composerEntering
      composer.style.removeProperty('--composer-draft-height')
    }
  }, [activeComposer])

  const closeMessageComposer: CloseMessageComposer = useCallback(
    (submit) => {
      const composer = composerRef.current
      if (!activeComposer || !composer || composer.hasAttribute('data-exiting')) {
        return
      }
      const translate = getComputedStyle(composer).translate
      composer.style.setProperty('--composer-exit-start', translate === 'none' ? '0 0' : translate)
      composer.style.setProperty(
        '--composer-exit-offset',
        `${Math.max(0, composer.offsetHeight - activeComposer.draftHeight)}px`
      )
      delete composer.dataset.composerEntering
      playExit(composer, () => {
        if (composer.hasAttribute('data-message-composer') && (!submit || submit())) {
          setMessageComposer(null)
        }
      })
    },
    [activeComposer]
  )

  const title = session.title || t('untitledChat')
  return (
    <div className={styles.view}>
      {isMobile ? (
        <MobileHeader title={title} />
      ) : (
        <div className={styles.header}>
          <input
            key={session.id + ':' + title}
            className={clsx(styles.title, siderCollapsed && styles.withCollapsedSider)}
            aria-label={t('sessionItemMenuRenameOption')}
            defaultValue={title}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim()
              event.currentTarget.value = value || title
              if (value && value !== title) {
                renameSession(session.id, value)
              }
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return
              }
              if (event.key === 'Escape') {
                event.currentTarget.value = title
              }
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.currentTarget.blur()
              }
            }}
          />
        </div>
      )}
      {activeComposer && (
        <button
          className={styles.composerMask}
          type="button"
          data-composer-mask={activeComposer.panel.kind}
          tabIndex={-1}
          aria-label={t('close')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => closeMessageComposer()}
        />
      )}
      <OpenMessageComposer.Provider value={openMessageComposer}>
        <MessageList
          key={session.id}
          session={session}
          streaming={streaming}
          footer={
            <div className={styles.inputContainer}>
              <div className={styles.composerSlot}>
                <ChatInput
                  sessionId={session.id}
                  composerRef={composerRef}
                  messageComposer={activeComposer}
                  onCloseMessageComposer={closeMessageComposer}
                />
              </div>
              <div className={styles.caveat}>{t('contentCaveat')}</div>
            </div>
          }
        />
      </OpenMessageComposer.Provider>
    </div>
  )
}
