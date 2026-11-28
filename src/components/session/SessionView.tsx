import clsx from 'clsx'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import type { Session } from '../../services/chat/types.js'
import { renameSession, useChatStore } from '../../services/chat/store.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { OpenMessageComposer } from '../chatInput/messageComposer.js'
import { MessageList } from '../messages/MessageList.js'
import { MobileHeader } from './MobileHeader.js'
import { useComposerIsland } from './useComposerIsland.js'
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
  const island = useComposerIsland(isMobile && !importing)

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
      {island.present && (
        <button
          ref={island.maskRef}
          className={styles.composerMask}
          type="button"
          data-composer-mask
          tabIndex={-1}
          aria-label={t('close')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={island.close}
        />
      )}
      <OpenMessageComposer.Provider value={island.open}>
        <MessageList
          key={session.id}
          session={session}
          streaming={streaming}
          footer={
            <div className={styles.inputContainer}>
              <div ref={island.slotRef} className={styles.composerSlot}>
                <ChatInput
                  sessionId={session.id}
                  composerRef={island.composerRef}
                  messageComposer={island.active}
                  onCloseMessageComposer={island.close}
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
