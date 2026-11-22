import { useTranslate } from '../../i18n/index.js'
import {
  authorizeHistoryLocation,
  chooseHistoryLocation,
  closeHistoryLocation,
  selectBrowserHistory,
  useHistoryLocation,
} from '../../services/chat/historyLocation.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export const HistoryLocationDialog = () => {
  const t = useTranslate()
  const { open, busy, location, needsPermission, failed } = useHistoryLocation()
  if (!open) {
    return null
  }
  return (
    <Modal
      title={t('historyDirectoryTitle')}
      onClose={location ? closeHistoryLocation : () => void selectBrowserHistory()}
      footer={
        <>
          <Button
            size="s"
            variant="outlined"
            disabled={busy}
            onClick={() => void selectBrowserHistory()}
          >
            {t('historyUseBrowser')}
          </Button>
          <Button
            size="s"
            variant={needsPermission ? 'outlined' : 'primary'}
            disabled={busy}
            onClick={() => void chooseHistoryLocation()}
          >
            {t('historyChooseDirectory')}
          </Button>
          {needsPermission && (
            <Button size="s" disabled={busy} onClick={() => void authorizeHistoryLocation()}>
              {t('historyGrantDirectory')}
            </Button>
          )}
        </>
      }
    >
      <div>{t('historyDirectoryDescription')}</div>
      {needsPermission && <div role="status">{t('historyDirectoryPermission')}</div>}
      {failed && <div role="alert">{t('historyDirectoryFailed')}</div>}
    </Modal>
  )
}
