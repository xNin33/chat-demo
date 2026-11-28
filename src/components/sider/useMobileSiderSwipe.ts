import { useEffect, type RefObject } from 'react'
import { useSidePreview } from '../files/sidePreviewState.js'
import { useSearchPanel } from '../search/searchPanelState.js'
import { closeMobileSider, openMobileSider, useMobileSider } from './mobileSiderState.js'

const ignored =
  'a, button:not([data-sider-mask]), input, textarea, select, pre, [contenteditable], .katex-display, [role="menu"], [data-selectable-message-text], [data-selecting]'

/** 表格、公式、图表等可横向滚动的区域里，横滑交给内容自身滚动。 */
const inHorizontalScroller = (target: Element | null, root: Element) => {
  for (let element = target; element && element !== root; element = element.parentElement) {
    if (
      element.scrollWidth > element.clientWidth &&
      /auto|scroll/.test(getComputedStyle(element).overflowX)
    ) {
      return true
    }
  }
  return false
}

/** 横滑时只更新抽屉位移，松手后用原有开关接管动画。 */
export const useMobileSiderSwipe = (frameRef: RefObject<HTMLDivElement>, enabled: boolean) => {
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !enabled) {
      return
    }
    let gesture: {
      x: number
      y: number
      open: boolean
      dragging: boolean
      progress: number
      width: number
      lastX: number
      lastTime: number
      velocity: number
    } | null = null
    const reset = () => {
      gesture = null
      delete frame.dataset.siderDragging
      frame.style.removeProperty('--mobile-sider-progress')
    }
    const start = (event: TouchEvent) => {
      const target = event.target as Element | null
      const open = useMobileSider.getState().open
      if (
        event.touches.length !== 1 ||
        target?.closest(ignored) ||
        document.querySelector('dialog[open], [aria-modal="true"], [data-composer-mask]') ||
        // 全屏的搜索结果和文件预览盖住了会话，不能在它们下面拉出抽屉。
        (!open && (useSearchPanel.getState().entry !== null || useSidePreview.getState().preview !== null)) ||
        (!open && inHorizontalScroller(target, frame))
      ) {
        reset()
        return
      }
      const { clientX, clientY } = event.touches[0]
      gesture = {
        x: clientX,
        y: clientY,
        open,
        dragging: false,
        progress: open ? 1 : 0,
        width: Math.min(frame.clientWidth * 0.82, 340),
        lastX: clientX,
        lastTime: event.timeStamp,
        velocity: 0,
      }
    }
    const move = (event: TouchEvent) => {
      if (!gesture) {
        return
      }
      if (!event.cancelable || event.touches.length !== 1) {
        reset()
        return
      }
      const { clientX, clientY } = event.touches[0]
      const dx = clientX - gesture.x
      const dy = clientY - gesture.y
      if (!gesture.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          reset()
          return
        }
        if (Math.abs(dx) < 9 || Math.abs(dx) < 1.35 * Math.abs(dy)) {
          return
        }
        if (gesture.open ? dx > 0 : dx < 0) {
          reset()
          return
        }
        gesture.dragging = true
        frame.dataset.siderDragging = ''
      }
      event.preventDefault()
      const elapsed = Math.max(1, event.timeStamp - gesture.lastTime)
      gesture.velocity = (clientX - gesture.lastX) / elapsed
      gesture.lastX = clientX
      gesture.lastTime = event.timeStamp
      const progress = (gesture.open ? 1 : 0) + dx / gesture.width
      gesture.progress = Math.min(1, Math.max(0, progress))
      const destination = gesture.open ? 0 : 1
      const distance = Math.abs(destination - gesture.progress)
      const pull = Math.min(1, distance / 0.16)
      const displayProgress = destination + (gesture.progress - destination) * pull
      frame.style.setProperty('--mobile-sider-progress', String(displayProgress))
    }
    const end = (event: TouchEvent) => {
      if (gesture?.dragging) {
        delete frame.dataset.siderDragging
        // 恢复过渡时保留拖动的最后一帧，让回弹从手指实际停下的位置起步。
        frame.getBoundingClientRect()
        if (event.type === 'touchend') {
          const velocity = event.timeStamp - gesture.lastTime < 100 ? gesture.velocity : 0
          const momentum = Math.max(-0.32, Math.min(0.32, (velocity * 110) / gesture.width))
          const cutoff = gesture.open ? 0.7 : 0.3
          if (gesture.progress + momentum > cutoff) {
            openMobileSider()
          } else {
            closeMobileSider()
          }
        }
      }
      reset()
    }
    frame.addEventListener('touchstart', start, { passive: true })
    frame.addEventListener('touchmove', move, { passive: false })
    frame.addEventListener('touchend', end)
    frame.addEventListener('touchcancel', end)
    return () => {
      reset()
      frame.removeEventListener('touchstart', start)
      frame.removeEventListener('touchmove', move)
      frame.removeEventListener('touchend', end)
      frame.removeEventListener('touchcancel', end)
    }
  }, [enabled, frameRef])
}
