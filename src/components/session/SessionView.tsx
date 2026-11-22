import clsx from 'clsx'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import type { Session } from '../../services/chat/types.js'
import { renameSession } from '../../services/chat/store.js'
import { ChatInput } from '../chatInput/ChatInput.js'
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
      <MessageList
        key={session.id}
        session={session}
        streaming={streaming}
        footer={
          <div className={styles.inputContainer}>
            <ChatInput sessionId={session.id} />
            <div className={styles.caveat}>{t('contentCaveat')}</div>
          </div>
        }
      />
    </div>
  )
}
