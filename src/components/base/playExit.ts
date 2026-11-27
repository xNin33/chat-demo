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
  const complete = () => {
    if (element.isConnected) {
      delete element.dataset.exiting
      finish()
    }
  }
  const animations = animatedElement?.getAnimations?.().filter((animation) => {
    const duration = animation.effect?.getComputedTiming().endTime ?? 0
    return typeof duration === 'number' && duration > 0 && Number.isFinite(duration)
  })
  if (animations?.length) {
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(complete)
  } else {
    complete()
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
