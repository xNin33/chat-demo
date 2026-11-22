import { create } from 'zustand'
import type { FileAttachment } from '../../services/chat/types.js'

type Preview =
  | { kind: 'html'; code: string; title: string; run: number }
  | { kind: 'file'; file: FileAttachment }

export const useSidePreview = create<{
  preview: Preview | null
}>(() => ({ preview: null }))

export const openHtmlPreview = (code: string) => {
  const titleMarkup = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(code)?.[0]
  const template = document.createElement('template')
  template.innerHTML = titleMarkup ?? ''
  const title = template.content.textContent?.trim() ?? ''
  useSidePreview.setState(({ preview }) => ({
    preview: { kind: 'html', code, title, run: preview?.kind === 'html' ? preview.run + 1 : 1 },
  }))
}

export const openFilePreview = (file: FileAttachment) =>
  useSidePreview.setState({ preview: { kind: 'file', file } })

export const closeSidePreview = () => useSidePreview.setState({ preview: null })
