import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { IconCheckOutline16, IconCloseOutline16, IconRotatePhoto20 } from '../base/icons.js'
import { closeAnimatedDialog } from '../base/playExit.js'
import './mobileAttachments.css'

type Crop = { left: number; top: number; right: number; bottom: number }
const full: Crop = { left: 0, top: 0, right: 1, bottom: 1 }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const corners = ['nw', 'ne', 'sw', 'se'] as const

export const PhotoCrop = ({
  file,
  onClose,
  onConfirm,
}: {
  file: File
  onClose: () => void
  onConfirm: (file: File) => void
}) => {
  const t = useTranslate()
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const picture = useRef<HTMLImageElement>(null)
  const drag = useRef<{
    bounds: DOMRect
    start: Crop
    x: number
    y: number
    handle: string
    id: number
  }>()
  const [url, setUrl] = useState('')
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState({ width: 0, height: 0 })
  const [turns, setTurns] = useState(0)
  const [crop, setCrop] = useState(full)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const sideways = turns % 2 !== 0
  const width = sideways ? image.height : image.width
  const height = sideways ? image.width : image.height
  const scale = width && height ? Math.min(viewport.width / width, viewport.height / height) : 0

  useLayoutEffect(() => {
    dialog.current?.showModal()
    const element = stage.current
    if (!element) {
      return
    }
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    const observer = new ResizeObserver(measure)
    measure()
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const rotate = () => {
    drag.current = undefined
    setTurns((count) => (count + 1) % 4)
    setCrop(({ left, top, right, bottom }) => ({
      left: 1 - bottom,
      top: left,
      right: 1 - top,
      bottom: right,
    }))
  }
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || event.button !== 0 || !event.isPrimary) {
      return
    }
    const handle = (event.target as HTMLElement).dataset.corner ?? 'move'
    const bounds = event.currentTarget.getBoundingClientRect()
    drag.current = {
      bounds,
      start: crop,
      x: event.clientX,
      y: event.clientY,
      handle,
      id: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) {
      return
    }
    const dx = (event.clientX - current.x) / current.bounds.width
    const dy = (event.clientY - current.y) / current.bounds.height
    const { left, right, top, bottom } = current.start
    if (current.handle === 'move') {
      const x = clamp(dx, -left, 1 - right)
      const y = clamp(dy, -top, 1 - bottom)
      setCrop({ left: left + x, right: right + x, top: top + y, bottom: bottom + y })
      return
    }
    const minX = Math.min(0.25, 26 / current.bounds.width)
    const minY = Math.min(0.25, 26 / current.bounds.height)
    setCrop({
      left: current.handle.includes('w') ? clamp(left + dx, 0, right - minX) : left,
      right: current.handle.includes('e') ? clamp(right + dx, left + minX, 1) : right,
      top: current.handle.includes('n') ? clamp(top + dy, 0, bottom - minY) : top,
      bottom: current.handle.includes('s') ? clamp(bottom + dy, top + minY, 1) : bottom,
    })
  }
  const confirm = async () => {
    const source = picture.current
    if (busy || !source || !width || !height) {
      return
    }
    setBusy(true)
    setFailed(false)
    const canvas = document.createElement('canvas')
    try {
      const left = Math.floor(crop.left * width)
      const top = Math.floor(crop.top * height)
      canvas.width = Math.max(1, Math.ceil(crop.right * width) - left)
      canvas.height = Math.max(1, Math.ceil(crop.bottom * height) - top)
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas unavailable')
      }
      context.translate(width / 2 - left, height / 2 - top)
      context.rotate((turns * Math.PI) / 2)
      context.drawImage(source, -image.width / 2, -image.height / 2)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.94)
      )
      if (!blob) {
        throw new Error('Image conversion failed')
      }
      if (dialog.current?.open) {
        closeAnimatedDialog(dialog.current, () =>
          onConfirm(
            new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, {
              type: 'image/jpeg',
            })
          )
        )
      }
    } catch {
      setFailed(true)
    } finally {
      canvas.width = canvas.height = 0
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="photo-crop"
      aria-label={t('cropPhoto')}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) {
          closeAnimatedDialog(event.currentTarget)
        }
      }}
    >
      <header>
        <button
          type="button"
          disabled={busy}
          aria-label={t('close')}
          onClick={() => closeAnimatedDialog(dialog.current)}
        >
          <IconCloseOutline16 />
        </button>
        <button type="button" disabled={busy || !width} onClick={rotate}>
          <IconRotatePhoto20 /> {t('rotatePhoto')}
        </button>
      </header>
      <div ref={stage} className="photo-crop-stage">
        <div
          className="photo-crop-frame"
          style={{ width: width * scale, height: height * scale }}
          onPointerDown={start}
          onPointerMove={move}
          onLostPointerCapture={() => {
            drag.current = undefined
          }}
        >
          {url && (
            <img
              ref={picture}
              src={url}
              alt={file.name}
              draggable={false}
              onLoad={(event) =>
                setImage({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setFailed(true)}
              style={{
                width: image.width * scale,
                height: image.height * scale,
                rotate: `${turns * 90}deg`,
              }}
            />
          )}
          {scale > 0 && (
            <div
              className="photo-crop-window"
              style={{
                left: `${crop.left * 100}%`,
                right: `${(1 - crop.right) * 100}%`,
                top: `${crop.top * 100}%`,
                bottom: `${(1 - crop.bottom) * 100}%`,
              }}
            >
              {corners.map((corner) => (
                <span key={corner} data-corner={corner} />
              ))}
            </div>
          )}
        </div>
      </div>
      {failed && (
        <div className="photo-crop-error" role="alert">
          {t('cropPhotoFailed')}
        </div>
      )}
      <footer>
        <button
          type="button"
          className="photo-crop-confirm"
          aria-label={t('confirm')}
          disabled={busy || !width}
          onClick={() => void confirm()}
        >
          <IconCheckOutline16 />
        </button>
      </footer>
    </dialog>
  )
}
