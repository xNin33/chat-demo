import { create } from 'zustand'
import { createId } from '../../utils/id.js'
import { exportSavedHistory, importHistory } from './backup.js'
import {
  loadSessionSummaries,
  onHistoryChanged,
  readHistoryLocation,
  reportStorageError,
  writeHistoryLocation,
  type HistoryLocation,
} from './db.js'
import { useDrafts } from './drafts.js'
import { canChooseHistoryDirectory } from './storageMode.js'
import { useChatStore } from './store.js'

const readWrite = { mode: 'readwrite' } as const
type PermissionedDirectory = FileSystemDirectoryHandle & {
  queryPermission: (options: typeof readWrite) => Promise<PermissionState>
  requestPermission: (options: typeof readWrite) => Promise<PermissionState>
}
type DirectoryWithFiles = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
}
type ExistingHistory = { directory: FileSystemDirectoryHandle; archive: FileSystemFileHandle }

type LocationState = {
  location: HistoryLocation | null
  open: boolean
  busy: boolean
  needsPermission: boolean
  failed: boolean
  restoreFailed: boolean
  pendingRestore: ExistingHistory | null
}

export const useHistoryLocation = create<LocationState>(() => ({
  location: null,
  open: false,
  busy: false,
  needsPermission: false,
  failed: false,
  restoreFailed: false,
  pendingRestore: null,
}))

const { getState: get, setState: set } = useHistoryLocation
const permissionCheck = (directory: FileSystemDirectoryHandle) =>
  (directory as PermissionedDirectory).queryPermission(readWrite)
const withLocationLock = <T>(run: () => Promise<T>) =>
  navigator.locks ? navigator.locks.request('chat-demo-history-location', run) : run()

let initialized: Promise<void> | undefined
let timer: number | undefined
let saves: Promise<void> = Promise.resolve()
let restoringHistory = false

export const openHistoryLocation = () => set({ open: true, restoreFailed: false })
export const closeHistoryLocation = () => {
  if (!get().busy) {
    set({ open: false, pendingRestore: null })
  }
}

const isSavedLocation = async (location: HistoryLocation) => {
  const saved = await readHistoryLocation()
  return saved?.fileName === location.fileName && saved.directory.isSameEntry(location.directory)
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
      if (!(await isSavedLocation(location))) {
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
        !(await isSavedLocation(location))
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
    .then(() => withLocationLock(write))
    .catch(reportFailure)
  return saves
}

export const retryHistoryLocationSave = () => {
  const { location } = get()
  return location ? saveArchive(location) : undefined
}

const flushHistoryLocationSave = () => {
  window.clearTimeout(timer)
  timer = undefined
  return retryHistoryLocationSave()
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
  const onVisibilityChange = () => {
    if (timer !== undefined && document.visibilityState === 'hidden') {
      void flushHistoryLocationSave()
    }
  }
  const unsubscribe = onHistoryChanged(() => {
    if (!restoringHistory && get().location && !get().needsPermission) {
      window.clearTimeout(timer)
      timer = window.setTimeout(flushHistoryLocationSave, 700)
    }
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.clearTimeout(timer)
  }
}

const managedArchive = /^chat-demo-history-.+\.zip$/i
const exportedArchive = /^deepseek_data-.+\.zip$/i
const newArchiveName = () => `chat-demo-history-${createId()}.zip`

const findHistoryArchive = async (directory: DirectoryWithFiles) => {
  let newest: { handle: FileSystemFileHandle; lastModified: number } | undefined
  for await (const handle of directory.values()) {
    if (handle.kind !== 'file' ||
        (!managedArchive.test(handle.name) && !exportedArchive.test(handle.name))) {
      continue
    }
    const { lastModified } = await handle.getFile()
    if (!newest || lastModified > newest.lastModified ||
        (lastModified === newest.lastModified && handle.name < newest.handle.name)) {
      newest = { handle, lastModified }
    }
  }
  return newest?.handle
}

const saveNewLocation = async (location: HistoryLocation) => {
  await withLocationLock(async () => {
    await writeHistoryLocation(location)
    set({ location, needsPermission: false })
  })
  await saveArchive(location)
  if (!get().failed && !get().needsPermission) {
    set({ open: false })
  }
}

const restoreExistingHistory = async ({ directory, archive }: ExistingHistory) => {
  const reuseArchive = managedArchive.test(archive.name)
  const location = { directory, fileName: reuseArchive ? archive.name : newArchiveName() }
  try {
    if (timer !== undefined) {
      await flushHistoryLocationSave()
    }
    await withLocationLock(async () => {
      restoringHistory = true
      try {
        await importHistory(await archive.getFile(), location)
        window.clearTimeout(timer)
        timer = undefined
        set({ location, needsPermission: false, pendingRestore: null, open: false, failed: false })
      } finally {
        restoringHistory = false
      }
    })
  } catch (error) {
    reportStorageError('restore history directory')(error)
    set({ pendingRestore: null, restoreFailed: true })
    return
  }
  // 手动导出的文件保留为快照，后续自动保存到独立文件。
  if (!reuseArchive) {
    await saveArchive(location)
  }
}

export const cancelHistoryLocationRestore = () => {
  if (!get().busy) {
    set({ pendingRestore: null })
  }
}

export const confirmHistoryLocationRestore = async () => {
  const { busy, pendingRestore } = get()
  if (!busy && pendingRestore) {
    set({ busy: true })
    try {
      await restoreExistingHistory(pendingRestore)
    } finally {
      set({ busy: false })
    }
  }
}

export const chooseHistoryLocation = async () => {
  if (!canChooseHistoryDirectory || get().busy) {
    return
  }
  const picker = Reflect.get(window, 'showDirectoryPicker') as (options: {
    mode: 'readwrite'
    id: string
  }) => Promise<DirectoryWithFiles>
  set({ busy: true, failed: false, restoreFailed: false })
  try {
    const directory = await picker.call(window, { ...readWrite, id: 'chat-demo-history' })
    const previous = get().location
    if (previous && (await directory.isSameEntry(previous.directory))) {
      await saveNewLocation({ directory, fileName: previous.fileName })
      return
    }
    const archive = await findHistoryArchive(directory)
    if (!archive) {
      await saveNewLocation({ directory, fileName: newArchiveName() })
      return
    }
    const selection = { directory, archive }
    if ((await loadSessionSummaries()).length || useChatStore.getState().sessions.length ||
        useDrafts.getState().drafts.size) {
      set({ pendingRestore: selection })
    } else {
      await restoreExistingHistory(selection)
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
    await withLocationLock(async () => {
      await writeHistoryLocation(null)
      set({ location: null, open: false, failed: false, needsPermission: false, restoreFailed: false })
    })
  } catch (error) {
    reportStorageError('save history preference')(error)
    set({ failed: true })
  } finally {
    set({ busy: false })
  }
}
