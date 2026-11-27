import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { normalizeEndpoint, type ApiMode, type CustomApiSettings, type SearchSource } from '../../services/api/config.js'
import { setApiMode, setCustomApi, useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { Select } from '../base/Select.js'
import styles from './Settings.module.css'

export const ApiModeSetting = () => {
  const t = useTranslate()
  const mode = useSettings((state) => state.apiMode)
  return (
    <div className={styles.cell}>
      <div className={styles.label}>{t('apiMode')}</div>
      <Select<ApiMode>
        ariaLabel={t('apiMode')}
        value={mode}
        onChange={setApiMode}
        options={[
          { value: 'native', label: t('apiModeNative') },
          { value: 'custom', label: t('apiModeCustom') },
        ]}
      />
    </div>
  )
}

export const CustomApiSetting = () => {
  const t = useTranslate()
  const hasDeepSeekKey = useSettings((state) => Boolean(state.apiKey))
  const [draft, setDraft] = useState<CustomApiSettings>(() => useSettings.getState().customApi)
  const [status, setStatus] = useState<'saved' | 'invalid' | null>(null)
  const update = (values: Partial<CustomApiSettings>) => {
    setDraft((current) => ({ ...current, ...values }))
    setStatus(null)
  }
  const submit = () => {
    const endpoint = normalizeEndpoint(draft.endpoint)
    const searchEndpoint = normalizeEndpoint(draft.searchEndpoint)
    if (!endpoint || !draft.model.trim() || (draft.searchSource === 'custom' && !searchEndpoint)) {
      setStatus('invalid')
      return
    }
    const settings = {
      ...draft,
      endpoint,
      model: draft.model.trim(),
      apiKey: draft.apiKey.trim(),
      searchEndpoint: searchEndpoint ?? '',
      searchApiKey: draft.searchApiKey.trim(),
    }
    setCustomApi(settings)
    setDraft(settings)
    setStatus('saved')
  }
  const sources: { value: SearchSource; label: string }[] = [
    { value: 'off', label: t('apiSearchOff') },
    { value: 'custom', label: t('apiSearchCustom') },
  ]
  if (hasDeepSeekKey) {
    sources.splice(1, 0, { value: 'deepseek', label: t('apiSearchDeepSeek') })
  }
  const fields = [
    { value: 'endpoint', label: 'apiMessagesEndpoint', placeholder: 'https://example.com/v1/messages', type: 'url' },
    { value: 'model', label: 'apiModel', type: 'text' },
    { value: 'apiKey', label: 'apiCustomKey', type: 'password' },
    ...(draft.searchSource === 'custom' ? [
      { value: 'searchEndpoint', label: 'apiSearchEndpoint', placeholder: 'https://example.com/search', type: 'url' },
      { value: 'searchApiKey', label: 'apiSearchKey', type: 'password' },
    ] as const : []),
  ] as const
  return (
    <form className={styles.apiConfiguration} noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
      <div className={styles.apiSearchRow}>
        <div className={styles.label}>{t('apiSearchSource')}</div>
        <Select<SearchSource>
          ariaLabel={t('apiSearchSource')}
          value={!hasDeepSeekKey && draft.searchSource === 'deepseek' ? 'off' : draft.searchSource}
          options={sources}
          onChange={(searchSource) => update({ searchSource })}
        />
      </div>
      {fields.map(({ value, label, type, ...input }) => (
        <label key={value} className={styles.apiField}>
          <span className={styles.label}>{t(label)}</span>
          <span className={styles.apiKeyInput}>
            <input {...input} type={type} value={draft[value]} autoComplete="off" spellCheck={false}
              onChange={(event) => update({ [value]: event.target.value })} />
          </span>
        </label>
      ))}
      {draft.searchSource === 'deepseek' ? (
        <div className={styles.description}>{t(hasDeepSeekKey ? 'apiDeepSeekSearchCost' : 'apiDeepSeekKeyRequired')}</div>
      ) : draft.searchSource === 'custom' ? (
        <div className={styles.description}>{t('apiSearchContract')}</div>
      ) : null}
      <div className={styles.apiSearchRow}>
        <span className={status === 'invalid' ? styles.error : styles.description} role="status">
          {status ? t(status === 'saved' ? 'apiSettingsSaved' : 'apiSettingsInvalid') : null}
        </span>
        <Button size="m" type="submit">{t('apiSettingsSave')}</Button>
      </div>
    </form>
  )
}
