/** 附件原件由本地服务保存，IndexedDB 只保留磁盘 ID 与 MIME。 */
export type DiskFile = { id: string; diskId: string; type: string }

const url = (id: string) => `/api/attachments/${encodeURIComponent(id)}`

const request = async (id: string, init?: RequestInit) => {
  let response: Response
  try {
    response = await fetch(url(id), init)
  } catch {
    throw new Error('无法连接本地附件服务 / Cannot connect to the local attachment service')
  }
  if (!response.ok && response.status !== 404) {
    throw new Error(`本地附件服务 / Local attachment service: ${response.status} ${await response.text()}`)
  }
  return response
}

export const writeDiskFile = async (id: string, blob: Blob): Promise<DiskFile> => {
  const diskId = crypto.randomUUID()
  const response = await request(diskId, {
    method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' },
  })
  if (!response.ok) {
    throw new Error('附件写入失败 / Could not save attachment')
  }
  return { id, diskId, type: blob.type }
}

export const readDiskFile = async (file: DiskFile): Promise<Blob | undefined> => {
  const response = await request(file.diskId)
  return response.status === 404 ? undefined : new Blob([await response.blob()], { type: file.type })
}

export const removeDiskFile = async (file: DiskFile): Promise<void> => {
  await request(file.diskId, { method: 'DELETE' })
}
