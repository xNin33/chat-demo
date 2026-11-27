import clsx from 'clsx'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDismiss } from './anchored.js'
import { playExit } from './playExit.js'
import type { PressPoint } from './useLongPress.js'
import styles from './Menu.module.css'

export type MenuOption = {
  key: string
  label: string
  icon: ReactNode
  danger?: boolean
  onSelect: () => void
}

/** 点击触发，向下展开；点外部或 Esc 关闭 */
export const Menu = ({
  options,
  children,
  point,
  onDismiss,
  variant,
}: {
  options: MenuOption[]
  children?: (props: { open: boolean; toggle: () => void }) => ReactNode
  point?: PressPoint | null
  onDismiss?: () => void
  variant?: 'message'
}) => {
  const [triggered, setTriggered] = useState(false)
  const open = triggered || !!point
  // 左侧对齐并再左移 5px，让菜单文字与触发元素图标对齐
  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLSpanElement, HTMLDivElement>(
    open,
    {
      align: point ? 'center' : 'start',
      alignOffset: point ? 0 : -5,
      offset: point ? 12 : 4,
      point,
    }
  )
  const close = () =>
    playExit(floatingRef.current, () => {
      setTriggered(false)
      onDismiss?.()
    })
  useDismiss(open, [anchorRef, floatingRef], close)
  const transformOrigin =
    point && position?.left !== undefined
      ? `${point.x - position.left}px ${point.y - position.top}px`
      : undefined

  return (
    <>
      {children && (
        <span ref={anchorRef} className={styles.anchor}>
          {children({ open, toggle: () => (open ? close() : setTriggered(true)) })}
        </span>
      )}
      {open
        ? createPortal(
            <div
              ref={floatingRef}
              className={clsx(
                styles.menu,
                point && styles.pressMenu,
                variant === 'message' && styles.messageMenu
              )}
              data-motion={position ? 'fade' : undefined}
              style={position ? { ...position, transformOrigin } : { visibility: 'hidden' }}
              role="menu"
            >
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="menuitem"
                  className={clsx(styles.option, option.danger && styles.danger)}
                  onClick={() => {
                    if (!floatingRef.current?.hasAttribute('data-exiting')) {
                      close()
                      option.onSelect()
                    }
                  }}
                >
                  <span className={styles.icon}>{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
