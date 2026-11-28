import clsx from 'clsx'
import { memo, useState } from 'react'
import { usePressMenu } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCheckedOutline14,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconMultiSelectOutline16,
  IconPinOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { renameSession, selectSession, setSessionsPinned } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { useLongPress } from '../base/useLongPress.js'
import { showToast } from '../base/toastState.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  onDelete,
  onSelectMultiple,
  selection,
  mobile = false,
}: {
  session: SessionSummary
  active: boolean
  onDelete: () => void
  /** 进入多选并选中这条会话 */
  onSelectMultiple?: () => void
  mobile?: boolean
  selection?: { checked: boolean; disabled: boolean; toggle: () => void }
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  // 窄窗口里的鼠标用户没有长按，继续显示「更多」按钮。
  const pressMenu = usePressMenu() && !!mobile
  const hold = useLongPress(pressMenu && !editing && !selection)
  const displayTitle = session.title || t('untitledChat')

  if (selection) {
    return (
      <label className={clsx(styles.item, styles.selectionItem)} data-session-id={session.id}>
        <input
          type="checkbox"
          checked={selection.checked}
          disabled={selection.disabled}
          onChange={selection.toggle}
        />
        <span className={styles.checkmark} aria-hidden="true">
          <IconCheckedOutline14 />
        </span>
        <span className={styles.title}>{displayTitle}</span>
      </label>
    )
  }

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  const togglePin = async () => {
    if (!(await setSessionsPinned(new Set([session.id]), !session.pinned))) {
      showToast({ key: 'pinSessionsFailed', type: 'error' })
    }
  }

  return (
    <div
      className={clsx(styles.item, active && styles.active)}
      data-press-menu={pressMenu ? '' : undefined}
      data-press-pulse={hold.pulsing || undefined}
      {...hold.handlers}
      onClick={() => {
        selectSession(session.id)
        closeMobileSider()
      }}
    >
      <div className={styles.title}>{displayTitle}</div>
      <div className={styles.action} onClick={(event) => event.stopPropagation()}>
        <Menu
          point={hold.point}
          onDismiss={hold.dismiss}
          options={[
            {
              key: 'pin',
              label: t(session.pinned ? 'unpinSessions' : 'pinSessions'),
              icon: <IconPinOutline16 />,
              onSelect: () => void togglePin(),
            },
            ...(onSelectMultiple
              ? [
                  {
                    key: 'select',
                    label: t('multiSelectSessions'),
                    icon: <IconMultiSelectOutline16 />,
                    onSelect: onSelectMultiple,
                  },
                ]
              : []),
            {
              key: 'rename',
              label: t('sessionItemMenuRenameOption'),
              icon: <IconEditOutline16 />,
              onSelect: () => setEditing(true),
            },
            {
              key: 'delete',
              label: t('delete'),
              icon: <IconTrashOutline16 />,
              danger: true,
              onSelect: onDelete,
            },
          ]}
        >
          {pressMenu
            ? undefined
            : ({ open, toggle }) => (
                <IconButton
                  icon={<IconEllipsisOutline16 />}
                  aria-label={t('more')}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={toggle}
                />
              )}
        </Menu>
      </div>
    </div>
  )
})
