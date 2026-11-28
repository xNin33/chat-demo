import { create } from 'zustand'
import { createId } from '../utils/id.js'
import { API_ORIGIN, EMPTY_CUSTOM_API, messagesEndpoint, NATIVE_MODEL, normalizeEndpoint, type ApiConnection, type ApiMode, type CustomApiSettings } from './api/config.js'
import type { TtsVoice } from './api/speech.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、深度思考与智能搜索开关、侧边栏收起状态 */
type Settings = {
  apiKey: string | null
  nativeFileScope?: string
  apiMode: ApiMode
  customApi: CustomApiSettings & { fileScope?: string }
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  nativeFileScope: 'chat-demo:native-file-scope',
  apiMode: 'chat-demo:api-mode',
  customApi: 'chat-demo:custom-api',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

const initialCustomApi = (): Settings['customApi'] => {
  try {
    const saved = JSON.parse(read(KEYS.customApi) ?? 'null')
    if (saved && typeof saved.endpoint === 'string' && typeof saved.model === 'string' &&
        typeof saved.apiKey === 'string' && typeof saved.searchEndpoint === 'string' &&
        typeof saved.searchApiKey === 'string') {
      return {
        endpoint: normalizeEndpoint(saved.endpoint) ?? '',
        model: saved.model,
        apiKey: saved.apiKey,
        searchEndpoint: normalizeEndpoint(saved.searchEndpoint) ?? '',
        searchApiKey: saved.searchApiKey,
        searchSource: saved.searchSource === 'deepseek' || saved.searchSource === 'custom' ? saved.searchSource : 'off',
        fileScope: typeof saved.fileScope === 'string' ? saved.fileScope : createId(),
      }
    }
  } catch {
    // 设置不可读取时使用默认值。
  }
  return EMPTY_CUSTOM_API
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

export const useSettings = create<Settings>(() => ({
  apiKey: read(KEYS.apiKey),
  nativeFileScope: read(KEYS.nativeFileScope) ?? undefined,
  apiMode: read(KEYS.apiMode) === 'custom' ? 'custom' : 'native',
  customApi: initialCustomApi(),
  locale: initialLocale(),
  location: initialLocation(),
  themePreference: initialThemePreference(),
  ttsVoice: initialTtsVoice(),
  thinking: read(KEYS.thinking) === 'true',
  search: read(KEYS.search) === 'true',
  siderCollapsed: read(KEYS.siderCollapsed) === 'true',
}))

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

export const setApiKey = (apiKey: string | null) => {
  const previous = useSettings.getState()
  const nativeFileScope = previous.apiKey && previous.apiKey !== apiKey ? createId() : previous.nativeFileScope
  write(KEYS.apiKey, apiKey)
  write(KEYS.nativeFileScope, nativeFileScope ?? null)
  useSettings.setState({ apiKey, nativeFileScope })
}

export const setApiMode = (apiMode: ApiMode) => {
  write(KEYS.apiMode, apiMode)
  useSettings.setState({ apiMode })
}

export const setCustomApi = (settings: CustomApiSettings) => {
  const old = useSettings.getState().customApi
  const sameConnection = old.endpoint === settings.endpoint && old.apiKey === settings.apiKey
  const customApi = { ...settings, fileScope: sameConnection && old.fileScope ? old.fileScope : createId() }
  write(KEYS.customApi, JSON.stringify(customApi))
  useSettings.setState({ customApi })
}

export const getChatConnection = (settings = useSettings.getState()): ApiConnection | undefined => {
  if (settings.apiMode === 'native') {
    return settings.apiKey ? {
      mode: 'native', messagesUrl: `${API_ORIGIN}/anthropic/v1/messages`, model: NATIVE_MODEL,
      apiKey: settings.apiKey, fileScope: settings.nativeFileScope,
    } : undefined
  }
  const custom = settings.customApi
  if (!custom.endpoint || !custom.model) {
    return undefined
  }
  const connection: ApiConnection = {
    mode: 'custom', messagesUrl: messagesEndpoint(custom.endpoint), model: custom.model,
    apiKey: custom.apiKey, fileScope: custom.fileScope,
  }
  if (custom.searchSource === 'deepseek' && settings.apiKey) {
    connection.search = {
      url: `${API_ORIGIN}/v1/tools/search`, apiKey: settings.apiKey, deepseek: true,
    }
  } else if (custom.searchSource === 'custom' && custom.searchEndpoint) {
    connection.search = { url: custom.searchEndpoint, apiKey: custom.searchApiKey, deepseek: false }
  }
  return connection
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
