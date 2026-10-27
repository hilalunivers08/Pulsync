export type DeviceType = 'desktop' | 'laptop' | 'phone' | 'tablet'

export type DeviceStatus = 'online' | 'idle' | 'busy'

export interface Device {
  id: string
  name: string
  type: DeviceType
  ip: string
  status: DeviceStatus
  os: string
  isSelf?: boolean
}

export type TransferStatus = 'completed' | 'in_progress' | 'failed' | 'queued'
export type TransferDirection = 'upload' | 'download'

export interface TransferItem {
  id: string
  fileName: string
  fileSize: string
  progress: number
  status: TransferStatus
  direction: TransferDirection
  speed?: string
  targetDevice: string
  timestamp: string
}
