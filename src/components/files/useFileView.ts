import { useEffect, useState } from 'react'
import { getFileViewType, isImage } from '../../services/attachments.js'
import { loadFile } from '../../services/chat/db.js'
import { showToast } from '../base/toastState.js'

const createViewUrl = (original: Blob, type: string) => {
  const blob = original.slice(0, original.size, type)
  if (type !== 'image/svg+xml') {
    return URL.createObjectURL(blob)
  }
  // SVG 缩略图用 data: 地址，单独打开图片时也与应用隔离。
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 草稿传 File，已发送的附件传 IndexedDB 原件 ID。 */
export const useImagePreviewUrl = (source: File | string | undefined, name: string) => {
  const type = getFileViewType(name)
  const [state, setState] = useState<{ source: File | string; type: string; url: string | null }>()
  useEffect(() => {
    if (source === undefined || !isImage(type)) {
      return
    }
    let active = true
    const original = typeof source === 'string' ? loadFile(source) : Promise.resolve(source)
    const pending = original
      .then((blob) => (active && blob ? createViewUrl(blob, type) : null))
      .catch(() => {
        if (active && typeof source === 'string') {
          showToast({ key: 'localAttachmentUnavailable', type: 'error' })
        }
        return null
      })
    void pending.then((url) => {
      if (active) {
        setState({ source, type, url })
      }
    })
    return () => {
      active = false
      void pending.then((url) => {
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [source, type])

  return state && state.source === source && state.type === type ? state.url : undefined
}
