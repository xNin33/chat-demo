import { create } from 'zustand'

type SearchState = {
  open: boolean
  target: { sessionId: string; messageId: string } | null
}

export const useHistorySearch = create<SearchState>(() => ({ open: false, target: null }))
export const openHistorySearch = () => useHistorySearch.setState({ open: true, target: null })
