import { useTranslate } from '../../i18n/index.js'
import {
  authorizeHistoryLocation,
  cancelHistoryLocationRestore,
  chooseHistoryLocation,
  closeHistoryLocation,
  confirmHistoryLocationRestore,
  selectBrowserHistory,
  useHistoryLocation,
} from '../../services/chat/historyLocation.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export const HistoryLocationDialog = () => {
  const t = useTranslate()
  const { open, busy, location, needsPermission, failed, restoreFailed, pendingRestore } = useHistoryLocation()
  if (!open) {
    return null
  }
  if (pendingRestore) {
    return (
      <Modal
        title={t('historyDirectoryRestoreTitle')}
        onClose={cancelHistoryLocationRestore}
        footer={
          <>
            <Button size="s" variant="outlined" autoFocus disabled={busy} onClick={cancelHistoryLocationRestore}>
              {t('cancel')}
            </Button>
            <Button size="s" variant="dangerOutlined" disabled={busy} onClick={() => void confirmHistoryLocationRestore()}>
              {t('historyDirectoryRestore')}
            </Button>
          </>
        }
      >
        {t('historyDirectoryRestoreDescription', { name: pendingRestore.archive.name })}
      </Modal>
    )
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
      {restoreFailed && <div role="alert">{t('historyDirectoryRestoreFailed')}</div>}
    </Modal>
  )
}
