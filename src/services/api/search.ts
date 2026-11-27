import { isWebUrl } from '../../utils/url.js'
import { ApiError, request } from './client.js'
import type { ApiConnection } from './config.js'
import type { WebSearchResult } from './types.js'

const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : ''

export const runWebSearch = async (
  search: NonNullable<ApiConnection['search']>,
  question: string,
  signal: AbortSignal
) => {
  const query = [...question.trim()].slice(0, 128).join('').trimEnd()
  const results: { source: WebSearchResult; summary: string }[] = []
  if (!query) {
    return { query, results }
  }
  try {
    const response = await request(search.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(search.apiKey ? { Authorization: `Bearer ${search.apiKey}` } : {}),
      },
      body: JSON.stringify({ query, count: 5 }),
      redirect: 'error',
      signal,
    })
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) {
      throw new ApiError('protocol', 'Expected a results array')
    }
    const seen = new Set<string>()
    const entries: unknown[] = data.results
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !('url' in entry) ||
          typeof entry.url !== 'string' || !isWebUrl(entry.url) || seen.has(entry.url)) {
        continue
      }
      const item = entry as Record<string, unknown> & { url: string }
      const title = text(item.title, 240) || item.url
      const snippet = text(item.snippet, 400)
      seen.add(item.url)
      results.push({
        source: {
          type: 'web_search_result', title, url: item.url, snippet,
          site_name: text(item.site_name, 120) || null,
          site_icon: null, encrypted_content: '', page_age: text(item.date, 60) || null,
        },
        summary: text(item.summary, 1200) || snippet,
      })
      if (results.length === 5) {
        break
      }
    }
    return { query, results }
  } catch (error) {
    signal.throwIfAborted()
    if (search.deepseek && error instanceof ApiError && error.status === 402) {
      throw new ApiError('http', { key: 'apiSearchInsufficientBalance' }, error.status)
    }
    throw new ApiError('protocol', {
      key: 'apiSearchRequestFailed',
      params: { message: error instanceof Error ? error.message : String(error) },
    })
  }
}
