import { create } from 'zustand'

type SearchState = {
  open: boolean
  origin: { left: number; top: number; width: number } | null
  target: { sessionId: string; messageId: string } | null
}

export const useHistorySearch = create<SearchState>(() => ({ open: false, origin: null, target: null }))
export const openHistorySearch = () => useHistorySearch.setState({ open: true, origin: null, target: null })

export const openHistorySearchFrom = (trigger: HTMLButtonElement) => {
  const { left, top, width } = trigger.getBoundingClientRect()
  useHistorySearch.setState({ open: true, origin: { left, top, width }, target: null })
}
