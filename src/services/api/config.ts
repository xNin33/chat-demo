export const API_ORIGIN = __API_ORIGIN__
export const NATIVE_MODEL = 'deepseek-flash'

export type ApiMode = 'native' | 'custom'
export type SearchSource = 'off' | 'deepseek' | 'custom'

export type CustomApiSettings = {
  endpoint: string
  model: string
  apiKey: string
  searchSource: SearchSource
  searchEndpoint: string
  searchApiKey: string
}

export const EMPTY_CUSTOM_API: CustomApiSettings = {
  endpoint: '',
  model: NATIVE_MODEL,
  apiKey: '',
  searchSource: 'off',
  searchEndpoint: '',
  searchApiKey: '',
}

export type ApiConnection = {
  mode: ApiMode
  messagesUrl: string
  model: string
  apiKey: string
  fileScope?: string
  search?: { url: string; apiKey: string; deepseek: boolean }
}

export const normalizeEndpoint = (value: string): string | undefined => {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
      return undefined
    }
    return url.href
  } catch {
    return undefined
  }
}

/** 兼容常见的服务基址，自定义路径按用户输入使用。 */
export const messagesEndpoint = (endpoint: string) => {
  const url = new URL(endpoint)
  const path = url.pathname.replace(/\/+$/, '')
  if (!path || path.endsWith('/anthropic')) {
    url.pathname = `${path}/v1/messages`
  } else if (path.endsWith('/v1')) {
    url.pathname = `${path}/messages`
  }
  return url.href
}

export const filesEndpoint = (messagesUrl: string, fileId?: string) => {
  const url = new URL(messagesUrl, location.href)
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = `${path.slice(0, path.lastIndexOf('/'))}/files${fileId ? `/${encodeURIComponent(fileId)}` : ''}`
  return url.href
}
