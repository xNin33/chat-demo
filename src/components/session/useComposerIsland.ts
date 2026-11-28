import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type {
  ActiveMessageComposer,
  CloseMessageComposer,
  MessageComposer,
} from '../chatInput/messageComposer.js'

/** 读取主题里的时长与曲线，减少动态效果时时长为 0。 */
const motion = () => {
  const style = getComputedStyle(document.body)
  const raw = style.getPropertyValue('--ds-transition-duration-slow').trim()
  const value = parseFloat(raw)
  const duration = raw.endsWith('ms') ? value : value * 1000
  return {
    duration: Number.isFinite(duration) ? duration : 300,
    easing: style.getPropertyValue('--ds-sheet-ease').trim() || 'cubic-bezier(0.32, 0.72, 0, 1)',
  }
}

/**
 * 随模式替换的内容。编辑与输入共用标了 data-island-keep 的底部功能栏，不参与淡入；
 * 选择文本没有功能栏，从它收起时整个输入区都要淡入。
 */
const swappedContent = (composer: HTMLElement, all = false) =>
  Array.from(
    composer.querySelectorAll<HTMLElement>(all ? ':scope > *' : ':scope > :not([data-island-keep])')
  )

/**
 * 移动端「编辑」「选择文本」把输入框原地变成对应的面板，像灵动岛一样：
 * 输入框贴着底边向上长高，原位置留出同样高度的占位，消息列表不重排。
 *
 * 模式与外形分开管理：内容由 panel 决定，外形由输入框上的 data-island 决定。
 * 收起时立即退出编辑或选择文本、换回输入区，外形继续从当前高度收回原高度，
 * 遮罩在同一条时间线上淡出，动画结束后才撤掉外形和占位。
 */
export const useComposerIsland = (enabled: boolean) => {
  const composerRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const maskRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<(ActiveMessageComposer & { exiting: boolean }) | null>(null)
  const present = enabled ? state : null
  const latest = useRef(present)
  latest.current = present
  /** 本组件发起的动画；中途切换时只取消这些，不影响内容自身的 CSS 动画 */
  const running = useRef<Animation[]>([])

  const play = (element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(keyframes, options)
    running.current.push(animation)
    return animation
  }
  const cancelRunning = () => {
    running.current.forEach((animation) => animation.cancel())
    running.current = []
  }

  const open = useCallback((panel: MessageComposer) => {
    const composer = composerRef.current
    if (!composer || latest.current?.exiting) {
      return
    }
    setState((current) => ({
      panel,
      restHeight: current?.restHeight ?? composer.offsetHeight,
      exiting: false,
    }))
  }, [])

  const isPresent = present !== null
  useLayoutEffect(() => {
    const composer = composerRef.current
    const slot = slotRef.current
    const current = latest.current
    if (!isPresent || !composer || !slot || !current) {
      return
    }
    // 占位保持展开前的高度；输入框改为贴底的绝对定位后按新内容测出展开高度，再从原高度长上去。
    slot.style.setProperty('--composer-rest-height', `${current.restHeight}px`)
    composer.dataset.island = ''
    const { duration, easing } = motion()
    const height = composer.offsetHeight
    cancelRunning()
    play(composer, [{ height: `${current.restHeight}px` }, { height: `${height}px` }], {
      duration,
      easing,
    })
    if (maskRef.current) {
      play(maskRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration, easing })
    }
    for (const element of swappedContent(composer)) {
      play(element, [{ opacity: 0 }, { opacity: 1 }], {
        duration: duration * 0.6,
        delay: duration * 0.1,
        easing: 'ease-out',
        fill: 'backwards',
      })
    }
    return () => {
      cancelRunning()
      slot.style.removeProperty('--composer-rest-height')
      delete composer.dataset.island
      delete composer.dataset.exiting
    }
  }, [isPresent])

  useEffect(() => {
    if (!enabled) {
      setState(null)
    }
  }, [enabled])

  const close: CloseMessageComposer = useCallback(() => {
    const composer = composerRef.current
    const current = latest.current
    if (!composer || !current || current.exiting) {
      return
    }
    if (
      document.activeElement instanceof HTMLElement &&
      composer.contains(document.activeElement)
    ) {
      document.activeElement.blur()
    }
    // 先记下当前的实际高度和透明度，展开途中收起也能接上。
    const mask = maskRef.current
    const from = getComputedStyle(composer).height
    const maskFrom = mask ? getComputedStyle(mask).opacity : '1'
    cancelRunning()
    composer.dataset.exiting = ''
    // 立即退出编辑或选择文本，输入区换回原草稿；外形仍是展开时的样子。
    flushSync(() => setState((value) => value && { ...value, exiting: true }))
    // 同一任务里接着开始收起，换回内容后不会先以自然高度绘制一帧。
    const { duration, easing } = motion()
    const options = { duration, easing, fill: 'forwards' } as const
    const shrink = play(
      composer,
      [{ height: from }, { height: `${current.restHeight}px` }],
      options
    )
    if (mask) {
      play(mask, [{ opacity: maskFrom }, { opacity: 0 }], options)
    }
    for (const element of swappedContent(composer, current.panel.kind === 'text')) {
      play(element, [{ opacity: 0 }, { opacity: 1 }], {
        duration: duration * 0.5,
        easing: 'ease-out',
      })
    }
    shrink.finished.then(
      // 先在同一帧内撤掉遮罩和外形，再取消停在终点的动画，避免回弹一帧。
      () => flushSync(() => setState(null)),
      () => {}
    )
  }, [])

  return {
    composerRef,
    slotRef,
    maskRef,
    /** 交给输入框的模式；收起动画开始时即为 null */
    active: present && !present.exiting ? present : null,
    /** 外形与遮罩是否在场，包括收起动画期间 */
    present: isPresent,
    open,
    close,
  }
}
