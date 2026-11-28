import clsx from 'clsx'
import { memo, useContext, useState } from 'react'
import { useIsMobile, usePressMenu } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { isPreviewImage } from '../../services/attachments.js'
import { retryUpload, useChatStore } from '../../services/chat/store.js'
import type { UserMessage as UserMessageType } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { IconEditOutline16 } from '../base/icons.js'
import type { MenuOption } from '../base/Menu.js'
import { useLongPress } from '../base/useLongPress.js'
import { OpenMessageComposer } from '../chatInput/messageComposer.js'
import {
  BranchSwitcher,
  type MessageVersions,
  type SelectMessageVersion,
} from './BranchSwitcher.js'
import { CopyButton } from './CopyButton.js'
import { MessageActionMenu } from './MessageActionMenu.js'
import { MessageFile } from './MessageFile.js'
import { MessageFold } from './MessageFold.js'
import { UserMessageEditor } from './UserMessageEditor.js'
import styles from './UserMessage.module.css'

export const UserMessage = memo(function UserMessage({
  sessionId,
  message,
  retryUploadId,
  isFirst,
  isLast,
  busy,
  versions,
  onSelectVersion,
  onEditingChange,
  expanded,
  onToggleExpanded,
}: {
  sessionId: string
  message: UserMessageType
  /** 回答因补传附件失败可重试时为该回答 id */
  retryUploadId: string | null
  isFirst: boolean
  isLast: boolean
  busy: boolean
  versions: MessageVersions
  onSelectVersion: SelectMessageVersion
  onEditingChange: (id: string, editing: boolean) => void
  expanded: boolean
  onToggleExpanded: (id: string) => void
}) {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const openComposer = useContext(OpenMessageComposer)
  const importing = useChatStore((state) => state.importingHistory)
  const editorDisabled = busy || importing
  const [editing, setEditing] = useState(false)
  const pressMenu = usePressMenu()
  const hold = useLongPress(pressMenu)
  const changeEditing = (next: boolean) => {
    setEditing(next)
    onEditingChange(message.id, next)
  }
  const menu: MenuOption[] = []
  if (hold.point && !editorDisabled) {
    menu.push({
      key: 'edit',
      label: t('editMessage'),
      icon: <IconEditOutline16 />,
      onSelect: () => openComposer({ kind: 'edit', message }),
    })
  }

  return (
    <div
      className={clsx(styles.container, isFirst && styles.isFirst)}
      data-press-menu={pressMenu ? '' : undefined}
      {...hold.handlers}
    >
      <MessageActionMenu
        point={hold.point}
        onDismiss={hold.dismiss}
        content={message.content ? { text: message.content } : undefined}
        actions={menu}
      />
      {editing && !isMobile ? (
        <>
          {versions.ids.length > 1 && (
            <div className={styles.editorBranch}>
              <BranchSwitcher
                versions={versions}
                disabled={editorDisabled}
                onSelect={(id, anchorTop) => {
                  changeEditing(false)
                  onSelectVersion(id, anchorTop)
                }}
              />
            </div>
          )}
          <UserMessageEditor
            sessionId={sessionId}
            message={message}
            busy={busy}
            onClose={(submit) => {
              if (!submit || submit()) {
                changeEditing(false)
              }
            }}
          />
        </>
      ) : (
        <>
          {message.files.length > 0 && (
            <div
              className={clsx(
                styles.files,
                message.files.some((file) => !isPreviewImage(file.name)) &&
                  styles.filesWithDocuments
              )}
              data-press-pulse={(hold.pulsing && !message.content) || undefined}
            >
              {message.files.map((file) => (
                <div key={file.id} className={styles.retainedFile}>
                  <MessageFile
                    file={file}
                    onRetry={retryUploadId ? () => retryUpload(sessionId, retryUploadId) : null}
                  />
                </div>
              ))}
            </div>
          )}
          {message.content ? (
            <div className={styles.bubble} data-press-pulse={hold.pulsing || undefined}>
              <MessageFold expanded={expanded} onToggle={() => onToggleExpanded(message.id)}>
                {message.content}
              </MessageFold>
            </div>
          ) : null}
          {(!pressMenu || versions.ids.length > 1) && (
            <div className={styles.bottom}>
              {!pressMenu && (
                <div className={clsx(styles.actions, isLast && styles.alwaysShow)}>
                  {message.content ? <CopyButton text={message.content} /> : null}
                  <IconButton
                    icon={<IconEditOutline16 />}
                    tooltip={t('editMessage')}
                    tooltipPlacement="bottom"
                    disabled={editorDisabled}
                    onClick={() =>
                      isMobile ? openComposer({ kind: 'edit', message }) : changeEditing(true)
                    }
                  />
                </div>
              )}
              <BranchSwitcher versions={versions} disabled={busy} onSelect={onSelectVersion} />
            </div>
          )}
        </>
      )}
    </div>
  )
})
