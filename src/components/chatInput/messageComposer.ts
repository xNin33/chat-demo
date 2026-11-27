import { createContext } from 'react'
import type { UserMessage } from '../../services/chat/types.js'

export type MessageComposer =
  | { kind: 'text'; text: string }
  | { kind: 'edit'; message: UserMessage }

export type ActiveMessageComposer = {
  panel: MessageComposer
  fromHeight: number
  draftHeight: number
}

export type CloseMessageComposer = (submit?: () => boolean) => void

export const OpenMessageComposer = createContext<(panel: MessageComposer) => void>(() => {})
