import { createContext } from 'react'
import type { UserMessage } from '../../services/chat/types.js'

/** 长按菜单里可复制、可选择的消息文字；回复保留 Markdown 源码。 */
export type SelectableText = { text: string }

export type MessageComposer =
  | { kind: 'edit'; message: UserMessage }
  /** 选择文本时原样展示的消息文字，回复为 Markdown 源码 */
  | { kind: 'text'; text: string }

export type ActiveMessageComposer = {
  panel: MessageComposer
  /** 输入框收起时的高度，展开期间占位，收起动画以它为终点 */
  restHeight: number
}

export type CloseMessageComposer = () => void

export const OpenMessageComposer = createContext<(panel: MessageComposer) => void>(() => {})
