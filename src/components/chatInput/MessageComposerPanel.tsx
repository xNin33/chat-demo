import { useTranslate } from '../../i18n/index.js'
import { IconButton } from '../base/IconButton.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { UserMessageEditor } from '../messages/UserMessageEditor.js'
import type { CloseMessageComposer, MessageComposer } from './messageComposer.js'
import styles from './ChatInput.module.css'

export const MessageComposerPanel = ({
  panel,
  sessionId,
  streaming,
  onClose,
}: {
  panel: MessageComposer
  sessionId: string
  streaming: boolean
  onClose: CloseMessageComposer
}) => {
  const t = useTranslate()
  const label = t(panel.kind === 'edit' ? 'editMessageInput' : 'selectMessageText')
  return (
    <section
      className={styles.messagePanel}
      aria-label={label}
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !event.nativeEvent.isComposing &&
          !(event.target as HTMLElement).closest('dialog[open]')
        ) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <header className={styles.messagePanelHeader}>
        <span>{label}</span>
        <IconButton
          icon={<IconCloseOutline16 />}
          tone="primary"
          aria-label={t('close')}
          autoFocus={panel.kind === 'text'}
          onClick={() => onClose()}
        />
      </header>
      <div className={styles.messagePanelBody}>
        {panel.kind === 'edit' ? (
          <UserMessageEditor
            key={panel.message.id}
            sessionId={sessionId}
            message={panel.message}
            busy={streaming}
            mobile
            onClose={onClose}
          />
        ) : (
          <div className={styles.selectableMessage} data-selectable-message-text>
            {panel.text}
          </div>
        )}
      </div>
    </section>
  )
}
