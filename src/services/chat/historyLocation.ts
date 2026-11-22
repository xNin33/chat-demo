import { create } from 'zustand'
import { createId } from '../../utils/id.js'
import { exportSavedHistory } from './backup.js'
import {
  onHistoryChanged,
  readHistoryLocation,
  reportStorageError,
  writeHistoryLocation,
  type HistoryLocation,
} from './db.js'
import { canChooseHistoryDirectory } from './storageMode.js'

const readWrite = { mode: 'readwrite' } as const
type PermissionedDirectory = FileSystemDirectoryHandle & {
  queryPermission: (options: typeof readWrite) => Promise<PermissionState>
  requestPermission: (options: typeof readWrite) => Promise<PermissionState>
}

type LocationState = {
  location: HistoryLocation | null
  open: boolean
  busy: boolean
  needsPermission: boolean
  failed: boolean
}

export const useHistoryLocation = create<LocationState>(() => ({
  location: null,
  open: false,
  busy: false,
  needsPermission: false,
  failed: false,
}))

const { getState: get, setState: set } = useHistoryLocation
const permissionCheck = (directory: FileSystemDirectoryHandle) =>
  (directory as PermissionedDirectory).queryPermission(readWrite)

let initialized: Promise<void> | undefined
let timer: number | undefined
let saves: Promise<void> = Promise.resolve()

export const openHistoryLocation = () => set({ open: true })
export const closeHistoryLocation = () => {
  if (!get().busy) {
    set({ open: false })
  }
}

const saveArchive = (location: HistoryLocation) => {
  const reportFailure = (error: unknown) => {
    if (get().location === location) {
      reportStorageError('history directory')(error)
      set({ failed: true })
    }
  }
  const write = async () => {
    if (get().location !== location || get().needsPermission) {
      return
    }
    try {
      if ((await readHistoryLocation())?.fileName !== location.fileName) {
        return
      }
      if ((await permissionCheck(location.directory)) !== 'granted') {
        if (get().location === location) {
          set({ needsPermission: true, open: true })
        }
        return
      }
      const blob = await exportSavedHistory()
      if (
        get().location !== location ||
        (await readHistoryLocation())?.fileName !== location.fileName
      ) {
        return
      }
      const file = await location.directory.getFileHandle(location.fileName, { create: true })
      const writer = await file.createWritable()
      try {
        await writer.write(blob)
        await writer.close()
      } catch (error) {
        await writer.abort().catch(() => {})
        throw error
      }
      if (get().location === location) {
        set({ failed: false })
      }
    } catch (error) {
      reportFailure(error)
    }
  }
  saves = saves
    .then(() =>
      navigator.locks ? navigator.locks.request('chat-demo-history-location', write) : write()
    )
    .catch(reportFailure)
  return saves
}

export const retryHistoryLocationSave = () => {
  const { location } = get()
  return location ? saveArchive(location) : undefined
}

export const initHistoryLocation = () => {
  if (!canChooseHistoryDirectory) {
    return
  }
  initialized ??= (async () => {
    try {
      const location = await readHistoryLocation()
      if (location === undefined) {
        set({ open: true })
      } else if (location) {
        const needsPermission = (await permissionCheck(location.directory)) !== 'granted'
        // 补写关闭页面前已经提交到数据库的最新记录。
        set({ location, needsPermission, open: needsPermission })
        if (!needsPermission) {
          void saveArchive(location)
        }
      }
    } catch (error) {
      reportStorageError('read history location')(error)
      set({ open: true, failed: true })
    }
  })()
}

export const bindHistoryLocation = () => {
  if (!canChooseHistoryDirectory) {
    return
  }
  const flush = () => {
    window.clearTimeout(timer)
    timer = undefined
    void retryHistoryLocationSave()
  }
  const onVisibilityChange = () => {
    if (timer !== undefined && document.visibilityState === 'hidden') {
      flush()
    }
  }
  const unsubscribe = onHistoryChanged(() => {
    if (get().location && !get().needsPermission) {
      window.clearTimeout(timer)
      timer = window.setTimeout(flush, 700)
    }
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearTimeout(timer)
  }
}

export const chooseHistoryLocation = async () => {
  if (!canChooseHistoryDirectory || get().busy) {
    return
  }
  const picker = Reflect.get(window, 'showDirectoryPicker') as (options: {
    mode: 'readwrite'
    id: string
  }) => Promise<FileSystemDirectoryHandle>
  set({ busy: true, failed: false })
  try {
    const directory = await picker.call(window, { ...readWrite, id: 'chat-demo-history' })
    const previous = get().location
    const fileName =
      previous && (await directory.isSameEntry(previous.directory))
        ? previous.fileName
        : `chat-demo-history-${createId()}.zip`
    const location = { directory, fileName }
    await writeHistoryLocation(location)
    set({ location, needsPermission: false })
    await saveArchive(location)
    if (!get().failed && !get().needsPermission) {
      set({ open: false })
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      reportStorageError('choose history location')(error)
      set({ failed: true })
    }
  } finally {
    set({ busy: false })
  }
}

export const authorizeHistoryLocation = async () => {
  const { location, busy } = get()
  if (!location || busy) {
    return
  }
  set({ busy: true, failed: false })
  try {
    const directory = location.directory as PermissionedDirectory
    if ((await directory.requestPermission(readWrite)) === 'granted') {
      set({ needsPermission: false })
      await saveArchive(location)
      if (!get().failed && !get().needsPermission) {
        set({ open: false })
      }
    }
  } catch (error) {
    reportStorageError('authorize history location')(error)
    set({ failed: true })
  } finally {
    set({ busy: false })
  }
}

export const selectBrowserHistory = async () => {
  if (get().busy) {
    return
  }
  set({ busy: true })
  try {
    await writeHistoryLocation(null)
    set({ location: null, open: false, failed: false, needsPermission: false })
  } catch (error) {
    reportStorageError('save history preference')(error)
    set({ failed: true })
  } finally {
    set({ busy: false })
  }
}
