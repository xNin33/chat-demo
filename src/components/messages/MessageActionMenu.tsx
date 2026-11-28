import { useContext } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { copyText } from '../../utils/clipboard.js'
import { IconCopyOutline16, IconSelectTextOutline20, IconShareOutline20 } from '../base/icons.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { showToast } from '../base/toastState.js'
import type { PressPoint } from '../base/useLongPress.js'
import { OpenMessageComposer, type SelectableText } from '../chatInput/messageComposer.js'

const copyMessage = async (text: string) => {
  if (!(await copyText(text))) {
    showToast({ key: 'copyFailed' })
    return false
  }
  return true
}

const shareMessage = async (text: string) => {
  try {
    if (navigator.share && navigator.canShare?.({ text }) !== false) {
      await navigator.share({ text })
      return
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
  }
  if (await copyMessage(text)) {
    showToast({ key: 'shareMessageCopied' })
  }
}

/** 长按消息的操作菜单；「选择文本」把输入框原地换成可选择的消息文字。 */
export const MessageActionMenu = ({
  point,
  content,
  actions,
  onDismiss,
}: {
  point: PressPoint | null
  content?: SelectableText
  actions: MenuOption[]
  onDismiss: () => void
}) => {
  const t = useTranslate()
  const openComposer = useContext(OpenMessageComposer)
  const selectable = content?.text ? content : null
  const options: MenuOption[] = selectable
    ? [
        {
          key: 'copy',
          label: t('copy'),
          icon: <IconCopyOutline16 />,
          onSelect: () => void copyMessage(selectable.text),
        },
        {
          key: 'select',
          label: t('selectMessageText'),
          icon: <IconSelectTextOutline20 />,
          onSelect: () => openComposer({ kind: 'text', text: selectable.text }),
        },
        ...actions,
        {
          key: 'share',
          label: t('shareMessage'),
          icon: <IconShareOutline20 />,
          onSelect: () => void shareMessage(selectable.text),
        },
      ]
    : actions
  return point && options.length > 0 ? (
    <Menu variant="message" point={point} options={options} onDismiss={onDismiss} />
  ) : null
}
