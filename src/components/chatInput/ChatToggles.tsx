import clsx from 'clsx'
import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { getChatConnection, setSearch, setThinking, useSettings } from '../../services/settings.js'
import { IconGlobeLanguageOutline14, IconThinkOutline14 } from '../base/icons.js'
import { Tooltip } from '../base/Tooltip.js'
import { openSettings } from '../settings/settingsDialogState.js'
import styles from './ChatInput.module.css'

/** 点开关时不抢走文本框的焦点，键盘保持弹出，输入框不会因收起键盘而跳动。 */
const keepFocus = (event: MouseEvent) => event.preventDefault()

export const ChatToggles = ({ allowSettings = true }: { allowSettings?: boolean }) => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const native = useSettings((state) => state.apiMode === 'native')
  const thinking = useSettings((state) => state.thinking)
  const searchAvailable = useSettings(
    (state) => state.apiMode === 'native' || Boolean(getChatConnection(state)?.search)
  )
  const search = useSettings((state) => state.search) && searchAvailable
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const group = ref.current
    if (!group) {
      return
    }
    group.classList.remove(styles.collapsedToggles)
    if (isMobile) {
      return
    }
    const update = () => {
      group.classList.remove(styles.collapsedToggles)
      group.classList.toggle(styles.collapsedToggles, group.scrollWidth > group.clientWidth)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(group)
    return () => observer.disconnect()
  }, [isMobile, native, t])

  return (
    <div ref={ref} className={styles.toggles}>
      {native && (
        <Tooltip content={t('deactivatedThinkTooltip')}>
          <button
            type="button"
            className={clsx(styles.toggle, thinking && styles.selected)}
            aria-label={t('thinkingSwitch')}
            aria-pressed={thinking}
            onMouseDown={keepFocus}
            onClick={() => setThinking(!thinking)}
          >
            <IconThinkOutline14 />
            <span className={styles.toggleLabel}>{t('thinkingSwitch')}</span>
          </button>
        </Tooltip>
      )}
      <Tooltip content={t(searchAvailable ? 'deactivatedSearchTooltip' : 'apiChooseSearchSource')}>
        <button
          type="button"
          className={clsx(styles.toggle, search && styles.selected)}
          aria-label={t('search')}
          aria-pressed={search}
          onMouseDown={keepFocus}
          disabled={!searchAvailable && !allowSettings}
          onClick={() => (searchAvailable ? setSearch(!search) : openSettings('data'))}
        >
          <IconGlobeLanguageOutline14 />
          <span className={styles.toggleLabel}>{t('search')}</span>
        </button>
      </Tooltip>
    </div>
  )
}
