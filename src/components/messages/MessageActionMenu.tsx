import { useTranslate } from '../../i18n/index.js'
import { copyText } from '../../utils/clipboard.js'
import { IconCopyOutline16, IconSelectTextOutline20, IconShareOutline20 } from '../base/icons.js'
import { Menu, type MenuOption } from '../base/Menu.js'
import { showToast } from '../base/toastState.js'
import type { PressPoint } from '../base/useLongPress.js'

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

export const MessageActionMenu = ({
  point,
  text,
  actions,
  onSelectText,
  onDismiss,
}: {
  point: PressPoint | null
  text?: string
  actions: MenuOption[]
  onSelectText: () => void
  onDismiss: () => void
}) => {
  const t = useTranslate()
  if (!point || (!text && actions.length === 0)) {
    return null
  }
  const options: MenuOption[] = text
    ? [
        {
          key: 'copy',
          label: t('copy'),
          icon: <IconCopyOutline16 />,
          onSelect: () => void copyMessage(text),
        },
        {
          key: 'select',
          label: t('selectMessageText'),
          icon: <IconSelectTextOutline20 />,
          onSelect: onSelectText,
        },
        ...actions,
        {
          key: 'share',
          label: t('shareMessage'),
          icon: <IconShareOutline20 />,
          onSelect: () => void shareMessage(text),
        },
      ]
    : actions
  return <Menu variant="message" point={point} options={options} onDismiss={onDismiss} />
}
