import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconCloseOutline16 } from '../base/icons.js'
import { closeAnimatedDialog } from '../base/playExit.js'
import styles from './ImagePreview.module.css'

const FIT = { scale: 1, x: 0, y: 0 }

const constrainView = (view: typeof FIT, stage: HTMLElement, photo: HTMLElement) => {
  const maxX = Math.abs(photo.offsetWidth * view.scale - stage.clientWidth) / 2
  const maxY = Math.abs(photo.offsetHeight * view.scale - stage.clientHeight) / 2
  return {
    scale: view.scale,
    x: Math.min(maxX, Math.max(-maxX, view.x)),
    y: Math.min(maxY, Math.max(-maxY, view.y)),
  }
}

const zoomAt = (
  view: typeof FIT,
  scale: number,
  viewport: HTMLElement,
  photo: HTMLElement,
  point?: { clientX: number; clientY: number }
) => {
  const bounds = viewport.getBoundingClientRect()
  const x = point ? point.clientX - bounds.left - bounds.width / 2 : 0
  const y = point ? point.clientY - bounds.top - bounds.height / 2 : 0
  const ratio = scale / view.scale
  return constrainView(
    { scale, x: x + (view.x - x) * ratio, y: y + (view.y - y) * ratio },
    viewport,
    photo
  )
}

export const ImagePreview = ({
  src,
  name,
  onClose,
  onStep,
}: {
  src: string | undefined
  name: string
  onClose: () => void
  onStep?: (direction: -1 | 1) => void
}) => {
  const t = useTranslate()
  const ref = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const photo = useRef<HTMLButtonElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [view, setView] = useState(FIT)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<{
    id: number
    startX: number
    startY: number
    x: number
    y: number
  } | null>(null)
  const moved = useRef(false)
  const zoomed = view.scale > 1
  const zoomLabel = t(zoomed ? 'zoomOutImage' : 'zoomInImage')

  useLayoutEffect(() => {
    ref.current?.showModal()
  }, [])

  useLayoutEffect(() => {
    setView(FIT)
    setDragging(false)
    gesture.current = null
    moved.current = false
    const viewport = stage.current
    const imageButton = photo.current
    if (!viewport || !imageButton) {
      return
    }
    const observer = new ResizeObserver(() => {
      setView((current) => {
        if (current.scale === 1) {
          return current
        }
        const next = constrainView(current, viewport, imageButton)
        return next.x === current.x && next.y === current.y ? current : next
      })
    })
    observer.observe(viewport)
    observer.observe(imageButton)
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const originalWidth = image.current?.naturalWidth
      if (gesture.current || !event.deltaY || !originalWidth || !imageButton.offsetWidth) {
        return
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1
      const factor = Math.exp(-event.deltaY * unit * 0.002)
      const maxScale = Math.max(6, originalWidth / imageButton.offsetWidth)
      setView((current) => {
        const scale = Math.max(1, Math.min(maxScale, current.scale * factor))
        if (scale === current.scale) {
          return current
        }
        return scale === 1 ? FIT : zoomAt(current, scale, viewport, imageButton, event)
      })
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => {
      observer.disconnect()
      viewport.removeEventListener('wheel', wheel)
    }
  }, [src])

  const toggleZoom = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail && moved.current) {
      moved.current = false
      return
    }
    if (zoomed) {
      setView(FIT)
      return
    }
    const viewport = stage.current
    const imageButton = photo.current
    const originalWidth = image.current?.naturalWidth
    if (!viewport || !imageButton || !originalWidth || !imageButton.offsetWidth) {
      return
    }
    const scale = Math.max(2, originalWidth / imageButton.offsetWidth)
    setView(zoomAt(view, scale, viewport, imageButton, event.detail ? event : undefined))
  }

  return (
    <dialog
      ref={ref}
      className={styles.preview}
      aria-label={t('previewImage', { name })}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget || event.target === stage.current) {
          closeAnimatedDialog(event.currentTarget)
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        closeAnimatedDialog(event.currentTarget)
      }}
      onKeyDown={(event) => {
        if (onStep && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault()
          onStep(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
    >
      <div ref={stage} className={styles.stage}>
        <button
          ref={photo}
          type="button"
          className={styles.photo}
          data-zoomed={zoomed}
          data-dragging={dragging}
          aria-label={zoomLabel}
          disabled={!src}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          onClick={(event) => toggleZoom(event)}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) {
              return
            }
            moved.current = false
            if (zoomed) {
              gesture.current = {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: view.x,
                y: view.y,
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }
          }}
          onPointerMove={(event) => {
            const start = gesture.current
            const viewport = stage.current
            if (!start || start.id !== event.pointerId || !viewport) {
              return
            }
            const dx = event.clientX - start.startX
            const dy = event.clientY - start.startY
            if (!moved.current && Math.hypot(dx, dy) < 4) {
              return
            }
            moved.current = true
            setDragging(true)
            setView(
              constrainView(
                { scale: view.scale, x: start.x + dx, y: start.y + dy },
                viewport,
                event.currentTarget
              )
            )
          }}
          onLostPointerCapture={(event) => {
            if (gesture.current?.id === event.pointerId) {
              gesture.current = null
              setDragging(false)
            }
          }}
        >
          {src && <img ref={image} src={src} alt={name} draggable={false} />}
        </button>
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label={t('close')}
        onClick={() => closeAnimatedDialog(ref.current)}
      >
        <IconCloseOutline16 />
      </button>
    </dialog>
  )
}
