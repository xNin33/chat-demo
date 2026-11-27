import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { ACCEPT, isImage, MAX_COUNT, resolveMimeType } from '../../services/attachments.js'
import {
  IconCameraOutline20,
  IconCloseOutline16,
  IconPhotoOutline20,
  IconPaperclipOutline16,
} from '../base/icons.js'
import { PhotoCrop } from './PhotoCrop.js'
import { closeAnimatedDialog } from '../base/playExit.js'
import './mobileAttachments.css'

const takeFiles = (event: ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(event.currentTarget.files ?? [])
  event.currentTarget.value = ''
  return files
}

const PhotoThumb = ({ file }: { file: File }) => {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url ? <img src={url} alt="" loading="lazy" /> : null
}

const AlbumPicker = ({
  onConfirm,
  onClose,
}: {
  onConfirm: (files: File[]) => void
  onClose: () => void
}) => {
  const t = useTranslate()
  const dialog = useRef<HTMLDialogElement>(null)
  const images = useRef<HTMLInputElement>(null)
  const directory = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'photos' | 'albums'>('photos')
  const [files, setFiles] = useState<File[]>([])
  const [selected, setSelected] = useState<ReadonlySet<File>>(() => new Set())
  const [album, setAlbum] = useState<string>()
  const [visible, setVisible] = useState(60)
  const groups = new Map<string, File[]>()
  for (const file of files) {
    const path =
      file.webkitRelativePath.split('/').slice(0, -1).join('/') || t('attachmentSelectedPhotos')
    const group = groups.get(path) ?? []
    if (group.length === 0) {
      groups.set(path, group)
    }
    group.push(file)
  }
  const shown = album ? (groups.get(album) ?? []) : files
  useLayoutEffect(() => {
    dialog.current?.showModal()
  }, [])

  const importPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const added = takeFiles(event).filter((file) => isImage(resolveMimeType(file)))
    setFiles((previous) => [...previous, ...added])
    setSelected(
      (previous) =>
        new Set([...previous, ...added.slice(0, Math.max(0, MAX_COUNT - previous.size))])
    )
  }
  const selectPhoto = (file: File) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(file)) {
        next.delete(file)
      } else if (next.size < MAX_COUNT) {
        next.add(file)
      }
      return next
    })
  }
  const openFolder = () => {
    const picker = directory.current
    if (picker && 'webkitdirectory' in picker) {
      picker.webkitdirectory = true
      picker.click()
    } else {
      images.current?.click()
    }
  }
  return (
    <dialog
      ref={dialog}
      className="photo-picker"
      aria-label={t('attachmentAlbum')}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        closeAnimatedDialog(event.currentTarget)
      }}
    >
      <header>
        <button
          type="button"
          aria-label={t('close')}
          onClick={() => closeAnimatedDialog(dialog.current)}
        >
          <IconCloseOutline16 />
        </button>
        <div className="photo-picker-tabs">
          <button
            type="button"
            aria-pressed={tab === 'photos'}
            onClick={() => {
              setTab('photos')
              setAlbum(undefined)
            }}
          >
            {t('attachmentPhotos')}
          </button>
          <button type="button" aria-pressed={tab === 'albums'} onClick={() => setTab('albums')}>
            {t('attachmentAlbums')}
          </button>
        </div>
      </header>
      <div className="photo-picker-page" data-tab={tab} key={tab}>
        {tab === 'photos' ? (
          <>
            <button
              className="photo-picker-import"
              type="button"
              onClick={() => images.current?.click()}
            >
              {t('attachmentSelectPhotos')}
            </button>
            <div className="photo-picker-grid">
              {shown.slice(0, visible).map((file, index) => (
                <button
                  className="photo-picker-thumb"
                  type="button"
                  key={index}
                  aria-label={file.name}
                  aria-pressed={selected.has(file)}
                  onClick={() => selectPhoto(file)}
                >
                  <PhotoThumb file={file} />
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
            {shown.length > visible && (
              <button
                type="button"
                className="photo-picker-import"
                onClick={() => setVisible((count) => count + 60)}
              >
                {t('attachmentMorePhotos')}
              </button>
            )}
          </>
        ) : (
          <>
            <button className="photo-picker-import" type="button" onClick={openFolder}>
              {t('attachmentSelectFolder')}
            </button>
            <div className="photo-picker-albums">
              {[...groups].map(([name, items]) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => {
                    setAlbum(name)
                    setVisible(60)
                    setTab('photos')
                  }}
                >
                  <PhotoThumb file={items[0]} />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <footer>
        <button
          type="button"
          disabled={!selected.size}
          onClick={() => closeAnimatedDialog(dialog.current, () => onConfirm([...selected]))}
        >
          {t('attachmentAddPhotos', { count: selected.size })}
        </button>
      </footer>
      <input
        type="file"
        hidden
        multiple
        ref={images}
        accept="image/*"
        onChange={importPhotos}
        aria-label={t('attachmentSelectPhotos')}
      />
      <input
        type="file"
        hidden
        multiple
        ref={directory}
        onChange={importPhotos}
        aria-label={t('attachmentSelectFolder')}
      />
    </dialog>
  )
}

export const MobileAttachmentPicker = ({
  open,
  close,
  onFiles,
}: {
  open: boolean
  close: () => void
  onFiles: (files: File[]) => void
}) => {
  const t = useTranslate()
  const files = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [album, setAlbum] = useState(false)
  const [photo, setPhoto] = useState<File>()
  const accept = (picked: File[]) => {
    setAlbum(false)
    setPhoto(undefined)
    close()
    onFiles(picked)
  }
  return (
    <>
      <div className="mobile-attachment-tray" data-open={open} aria-hidden={!open}>
        <div className="mobile-attachment-tray-inner">
          <button type="button" tabIndex={open ? 0 : -1} onClick={() => camera.current?.click()}>
            <IconCameraOutline20 />
            {t('attachmentCamera')}
          </button>
          <button type="button" tabIndex={open ? 0 : -1} onClick={() => setAlbum(true)}>
            <IconPhotoOutline20 />
            {t('attachmentAlbum')}
          </button>
          <button type="button" tabIndex={open ? 0 : -1} onClick={() => files.current?.click()}>
            <IconPaperclipOutline16 />
            {t('attachmentFiles')}
          </button>
        </div>
      </div>
      <input
        type="file"
        hidden
        multiple
        ref={files}
        accept={ACCEPT}
        aria-label={t('attachmentFiles')}
        onChange={(event) => {
          const picked = takeFiles(event)
          if (picked.length) {
            accept(picked)
          }
        }}
      />
      <input
        type="file"
        hidden
        ref={camera}
        accept="image/*"
        capture="environment"
        aria-label={t('attachmentCamera')}
        onChange={(event) => {
          const [picked] = takeFiles(event)
          if (picked) {
            setPhoto(picked)
          }
        }}
      />
      {album && <AlbumPicker onClose={() => setAlbum(false)} onConfirm={accept} />}
      {photo && (
        <PhotoCrop
          file={photo}
          onClose={() => setPhoto(undefined)}
          onConfirm={(cropped) => accept([cropped])}
        />
      )}
    </>
  )
}
