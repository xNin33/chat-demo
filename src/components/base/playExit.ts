import { flushSync } from 'react-dom'

/** Keep an overlay mounted until its CSS exit animation finishes. */
export const playExit = (
  element: HTMLElement | null,
  finish: () => void,
  animatedElement = element
) => {
  if (!element) {
    finish()
    return
  }
  if (element.hasAttribute('data-exiting')) {
    return
  }
  element.dataset.exiting = ''
  const complete = (sync: boolean) => {
    if (!element.isConnected) {
      return
    }
    // 动画结束回调在绘制前执行：先同步提交卸载，再移除标记，避免元素以初始状态闪现一帧。
    try {
      if (sync) {
        finish()
      } else {
        flushSync(finish)
      }
    } finally {
      delete element.dataset.exiting
    }
  }
  const animations = animatedElement?.getAnimations?.().filter((animation) => {
    const duration = animation.effect?.getComputedTiming().endTime ?? 0
    return typeof duration === 'number' && duration > 0 && Number.isFinite(duration)
  })
  if (animations?.length) {
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() =>
      complete(false)
    )
  } else {
    complete(true)
  }
}

export const closeAnimatedDialog = (dialog: HTMLDialogElement | null, onExit?: () => void) => {
  if (dialog?.open) {
    playExit(dialog, () => {
      dialog.close()
      onExit?.()
    })
  }
}
