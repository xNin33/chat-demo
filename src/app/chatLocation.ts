import { newChat, selectSession, useChatStore } from '../services/chat/store.js'

const CHAT_PARAM = 'chat'

const writeChatLocation = (id: string | null, method: 'pushState' | 'replaceState') => {
  const url = new URL(window.location.href)
  if (url.searchParams.get(CHAT_PARAM) === id) {
    return
  }
  if (id === null) {
    url.searchParams.delete(CHAT_PARAM)
  } else {
    url.searchParams.set(CHAT_PARAM, id)
  }
  window.history[method](window.history.state, '', url)
}

/** 等会话列表就绪再解析链接。前进、后退与首次打开共用同一个入口。 */
export const bindChatLocation = () => {
  let restoring = false
  let restorePending = false
  const restore = () => {
    const state = useChatStore.getState()
    restorePending = !state.ready || state.importingHistory
    if (restorePending) {
      return
    }

    const id = new URL(window.location.href).searchParams.get(CHAT_PARAM)
    restoring = true
    try {
      if (id && state.sessions.some((session) => session.id === id)) {
        selectSession(id)
      } else {
        newChat()
        writeChatLocation(null, 'replaceState')
      }
    } finally {
      restoring = false
    }
  }

  const unsubscribe = useChatStore.subscribe((state, previous) => {
    if (restoring || !state.ready || state.importingHistory) {
      return
    }
    if (restorePending) {
      restore()
      return
    }
    if (state.activeId === previous.activeId && !previous.importingHistory) {
      return
    }
    const removed = previous.activeId !== null &&
      !state.sessions.some((session) => session.id === previous.activeId)
    writeChatLocation(state.activeId, previous.importingHistory || removed ? 'replaceState' : 'pushState')
  })

  window.addEventListener('popstate', restore)
  restore()
  return () => {
    window.removeEventListener('popstate', restore)
    unsubscribe()
  }
}
