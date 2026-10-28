import { useEffect, useMemo, useRef } from 'react'
import { API_BASE_URL } from '../config'

export interface LocalPeerState {
  id: string
  name: string
  connected: boolean
  connectionState: string
}

export interface LocalPublishedFile {
  id: string
  name: string
  size: number
  mimeType: string
  publishedAt: number
  expiresAt: number
  activeRecipients: number
  inactiveSince: number | null
}

export interface LocalAvailableFile {
  key: string
  fileID: string
  peerID: string
  name: string
  size: number
  mimeType: string
  fromName: string
  publishedAt: number
  expiresAt: number
  connected: boolean
  pending: boolean
  pendingStage?: string
  receiving: boolean
  statusMessage?: string
  statusLevel?: 'info' | 'success' | 'error' | string
}

export interface LocalCompletedFile {
  id: string
  name: string
  size: number
  fromName: string
  receivedAt: number
  downloadUrl: string
}

export interface LocalIncomingTransfer {
  id: string
  name: string
  size: number
  received: number
  fromName: string
  startedAt: number
  status: string
}

export interface LocalTransferNotice {
  message: string
  level: 'info' | 'success' | 'error' | string
  at: number
}

export interface LocalTransferState {
  status: string
  peerID: string
  displayName: string
  peers: LocalPeerState[]
  publishedFiles: LocalPublishedFile[]
  availableFiles: LocalAvailableFile[]
  completedFiles: LocalCompletedFile[]
  incomingTransfers: LocalIncomingTransfer[]
  notice?: LocalTransferNotice | null
}

export interface LocalTransferApi {
  getState: () => LocalTransferState
  publishFile: (file: File, targetPeerID?: string) => { ok: boolean; message?: string; id?: string }
  downloadFile: (key: string) => { ok: boolean; message?: string }
  saveReceivedFile: (id: string) => { ok: boolean; message?: string }
  removePublishedFile: (id: string) => boolean
  clearNotice: () => void
  retry: () => Promise<void>
}

interface LocalTransferWorkspaceProps {
  username: string
  theme: string
  onState: (state: LocalTransferState) => void
  onApi: (api: LocalTransferApi | null) => void
}

/**
 * Runs the already-tested local-only transfer engine in a hidden, same-origin
 * frame. The user's original dashboard remains the visible UI.
 */
export function LocalTransferWorkspace({ username, theme, onState, onApi }: LocalTransferWorkspaceProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const latestStateRef = useRef(onState)
  const latestApiRef = useRef(onApi)
  const frameSrc = useMemo(
    () => `/poc/discovery/index.html?embedded=1&headless=1&api=${encodeURIComponent(API_BASE_URL)}`,
    [],
  )

  useEffect(() => { latestStateRef.current = onState }, [onState])
  useEffect(() => { latestApiRef.current = onApi }, [onApi])

  const sendConfiguration = () => {
    frameRef.current?.contentWindow?.postMessage(
      { type: 'pulsync:configure', username, theme },
      window.location.origin,
    )
  }

  useEffect(() => {
    let previousSignature = ''
    let announcedApi: LocalTransferApi | null = null
    const pollState = () => {
      try {
        const frameWindow = frameRef.current?.contentWindow as (Window & { PulsyncLocalTransfer?: LocalTransferApi }) | null
        const api = frameWindow?.PulsyncLocalTransfer || null
        if (!api) return
        if (api !== announcedApi) {
          announcedApi = api
          latestApiRef.current(api)
        }
        const state = api.getState()
        const signature = JSON.stringify({
          status: state.status,
          peerID: state.peerID,
          displayName: state.displayName,
          peers: state.peers,
          publishedFiles: state.publishedFiles,
          availableFiles: state.availableFiles,
          completedFiles: state.completedFiles.map(file => ({ id: file.id, name: file.name, size: file.size, fromName: file.fromName, receivedAt: file.receivedAt, downloadUrl: file.downloadUrl })),
          incomingTransfers: state.incomingTransfers,
          notice: state.notice,
        })
        if (signature !== previousSignature) {
          previousSignature = signature
          latestStateRef.current(state)
        }
      } catch (error) {
        // During initial iframe navigation the same-origin API may not exist yet.
        console.debug('[Pulsync] Local transfer engine is initializing.', error)
      }
    }

    const interval = window.setInterval(pollState, 700)
    pollState()
    return () => {
      window.clearInterval(interval)
      latestApiRef.current(null)
    }
  }, [])

  useEffect(() => {
    sendConfiguration()
  }, [username, theme])

  return (
    <iframe
      ref={frameRef}
      title="Pulsync local transfer engine"
      src={frameSrc}
      aria-hidden="true"
      tabIndex={-1}
      onLoad={sendConfiguration}
      style={{ position: 'fixed', left: '-10000px', top: 0, width: 1, height: 1, border: 0, opacity: 0, pointerEvents: 'none' }}
    />
  )
}
