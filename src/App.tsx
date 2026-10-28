import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './styles/index.css'
import { PulsarBackground } from './components/PulsarBackground.tsx'
import { FileDropzone } from './components/FileDropzone.tsx'
import { ConnectedDevices } from './components/ConnectedDevices.tsx'
import { RecentTransfers, type LocalTransferFileView } from './components/RecentTransfers.tsx'
import { LocalTransferWorkspace, type LocalTransferApi, type LocalTransferState } from './components/LocalTransferWorkspace.tsx'
import type { Device } from './types/index.ts'
import { API_BASE_URL } from './config'

const SPACE_WORDS = ["Earth", "Mars", "Blackhole", "Europa", "Supernova", "Nebula", "Jupiter", "Andromeda", "Pulsar", "Voyager"]

function getInitialUsername() {
  if (typeof window === 'undefined') return 'Pulsar-User'
  const stored = localStorage.getItem('pulsync_username')
  if (stored && stored.trim() !== '') return stored
  const word = SPACE_WORDS[Math.floor(Math.random() * SPACE_WORDS.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  const generated = `${word}-${num}`
  localStorage.setItem('pulsync_username', generated)
  return generated
}

const EMPTY_LOCAL_TRANSFER_STATE: LocalTransferState = {
  status: 'Memulai…', peerID: '', displayName: '', peers: [], publishedFiles: [],
  availableFiles: [], completedFiles: [], incomingTransfers: [], notice: null,
}

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [username, setUsername] = useState<string>(getInitialUsername())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showUsernameDialog, setShowUsernameDialog] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState(username)
  const headerActionsRef = useRef<HTMLDivElement>(null)
  const p2pApiRef = useRef<LocalTransferApi | null>(null)
  const [p2pState, setP2pState] = useState<LocalTransferState>(EMPTY_LOCAL_TRANSFER_STATE)
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('pulsync_theme') || 'dark'
  })


  const localFiles = useMemo<LocalTransferFileView[]>(() => {
    const published = p2pState.publishedFiles.map((file) => ({
      id: file.id,
      key: file.id,
      original_name: file.name,
      file_size: file.size,
      expires_at: new Date(file.expiresAt).toISOString(),
      active_downloads: file.activeRecipients,
      source_name: 'Perangkat ini',
      kind: 'published' as const,
    }))
    const available = p2pState.availableFiles.map((file) => ({
      id: file.key,
      key: file.key,
      original_name: file.name,
      file_size: file.size,
      expires_at: new Date(file.expiresAt).toISOString(),
      active_downloads: 0,
      source_name: file.fromName,
      kind: 'available' as const,
      can_download: file.connected && !file.pending && !file.receiving,
      pending: file.pending,
      pending_stage: file.pendingStage,
      receiving: file.receiving,
      status_message: file.statusMessage,
      status_level: file.statusLevel,
    }))
    const incoming = p2pState.incomingTransfers.map((file) => ({
      id: file.id,
      key: file.id,
      original_name: file.name,
      file_size: file.size,
      active_downloads: 0,
      source_name: file.fromName,
      kind: 'incoming' as const,
      progress: file.size === 0 ? 100 : Math.floor((file.received / file.size) * 100),
    }))
    const received = p2pState.completedFiles.map((file) => ({
      id: file.id,
      key: file.id,
      original_name: file.name,
      file_size: file.size,
      active_downloads: 0,
      source_name: `Diterima dari ${file.fromName}`,
      kind: 'received' as const,
      download_url: file.downloadUrl,
    }))
    return [...published, ...available, ...incoming, ...received]
  }, [p2pState])

  const handlePublishLocal = (file: File) => {
    const api = p2pApiRef.current
    if (!api) return { ok: false, message: 'Mesin transfer lokal sedang dimulai. Coba lagi sebentar.' }
    return api.publishFile(file, selectedDevice?.id)
  }

  const handleDownloadLocal = (key: string) => {
    const result = p2pApiRef.current?.downloadFile(key)
    if (result && !result.ok) console.warn('[Pulsync] Gagal meminta file:', result.message)
  }

  const handleSaveReceivedFile = (id: string) => {
    const result = p2pApiRef.current?.saveReceivedFile(id)
    if (result && !result.ok) console.warn('[Pulsync] Gagal menyimpan berkas yang diterima:', result.message)
  }

  const handleRemoveLocal = (id: string) => {
    p2pApiRef.current?.removePublishedFile(id)
  }

  const handleClearLocal = () => {
    const api = p2pApiRef.current
    if (!api) return
    for (const file of p2pState.publishedFiles) api.removePublishedFile(file.id)
  }

  useEffect(() => {
    if (selectedDevice && !p2pState.peers.some(peer => peer.id === selectedDevice.id)) {
      setSelectedDevice(null)
    }
  }, [selectedDevice, p2pState.peers])

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device)
  }



  const sendPresenceInstant = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, name: username })
      })
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    sendPresenceInstant()
    const interval = setInterval(sendPresenceInstant, 3000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendPresenceInstant()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [username])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('pulsync_theme', theme)
  }, [theme])

  useEffect(() => {
    if (!showUsernameDialog) return

    const handleDialogEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUsernameDialog(false)
    }
    document.addEventListener('keydown', handleDialogEscape)
    return () => document.removeEventListener('keydown', handleDialogEscape)
  }, [showUsernameDialog])

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!headerActionsRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  const handleSetUsername = () => {
    setUsernameDraft(username)
    setMenuOpen(false)
    setShowUsernameDialog(true)
  }

  const handleSaveUsername = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const newName = usernameDraft.trim().replace(/\s+/g, ' ').slice(0, 32)
    if (!newName) return

    setUsername(newName)
    localStorage.setItem('pulsync_username', newName)
    setShowUsernameDialog(false)
  }

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    setMenuOpen(false)
  }

  return (
    <div className="pulsync-app-wrapper">
      <PulsarBackground />

      <div className="pulsync-app w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 overflow-x-hidden">
        <header className="dashboard-header">
          <div className="brand-section">
            <div className="brand-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" />
                <path d="m4.93 4.93 4.24 4.24" />
                <path d="m14.83 14.83 4.24 4.24" />
                <path d="M2 12h20" />
                <path d="m4.93 19.07 4.24-4.24" />
                <path d="m14.83 9.17 4.24-4.24" />
              </svg>
            </div>
            <div className="brand-details">
              <h1>PULSYNC</h1>
              <span className="brand-tagline">Local High-Speed Peer File Transfer</span>
            </div>
          </div>

          <div className="header-actions" ref={headerActionsRef}>
            <div className="username-pill" title="Nama perangkat ini">
              <span className="username-rocket" aria-hidden="true">🚀</span>
              <span className="username-label">{username}</span>
            </div>

            <button
              type="button"
              className="header-menu-trigger"
              aria-label="Buka menu Pulsync"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">⋮</span>
            </button>

            {menuOpen && (
              <div className="header-menu-popover" role="menu" aria-label="Menu Pulsync">
                <button type="button" className="header-menu-item" role="menuitem" onClick={handleSetUsername}>
                  <span className="header-menu-item-icon" aria-hidden="true">✎</span>
                  <span>Set username</span>
                </button>
                <button type="button" className="header-menu-item" role="menuitem" onClick={handleToggleTheme}>
                  <span className="header-menu-item-icon" aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span>
                  <span>Mode {theme === 'dark' ? 'Terang' : 'Gelap'}</span>
                </button>
                <a
                  href="/contact"
                  className="header-menu-item header-menu-link"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="header-menu-item-icon" aria-hidden="true">↗</span>
                  <span>Contact me</span>
                </a>
              </div>
            )}
          </div>
        </header>

        <section>
          <FileDropzone
            selectedDeviceName={selectedDevice ? selectedDevice.name : 'Jaringan Lokal'}
            transportMode="local"
            onPublishLocal={handlePublishLocal}
          />
        </section>

        {p2pState.notice && (
          <div className={`local-transfer-notice is-${p2pState.notice.level || 'info'}`} role="status" aria-live="polite">
            <span>{p2pState.notice.message}</span>
            <button type="button" className="local-transfer-notice-dismiss" aria-label="Tutup notifikasi" onClick={() => p2pApiRef.current?.clearNotice()}>×</button>
          </div>
        )}

        <main className="dashboard-grid flex flex-col lg:flex-row w-full gap-4">
          <div className="w-full lg:w-1/2">
            <ConnectedDevices
              p2pPeers={p2pState.peers}
              selectedDeviceId={selectedDevice?.id}
              onSelectDevice={handleSelectDevice}
            />
          </div>
          <div className="w-full lg:w-1/2">
            <RecentTransfers
              localFiles={localFiles}
              onDownloadLocalFile={handleDownloadLocal}
              onSaveReceivedFile={handleSaveReceivedFile}
              onRemoveLocalFile={handleRemoveLocal}
              onClearLocalFiles={handleClearLocal}
            />
          </div>
        </main>
      </div>
      <LocalTransferWorkspace
        username={username}
        theme={theme}
        onState={setP2pState}
        onApi={(api) => { p2pApiRef.current = api }}
      />
      {showUsernameDialog && (
        <div
          className="username-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowUsernameDialog(false)
          }}
        >
          <form
            className="username-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="username-dialog-title"
            onSubmit={handleSaveUsername}
          >
            <div className="username-dialog-mark" aria-hidden="true">✎</div>
            <h2 id="username-dialog-title">Set username</h2>
            <p>Nama ini akan terlihat oleh perangkat lain di jaringan lokal.</p>
            <label htmlFor="pulsync-username-input">Username</label>
            <input
              id="pulsync-username-input"
              autoFocus
              maxLength={32}
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder="Contoh: ANDROMEDA-4319"
            />
            <div className="username-dialog-actions">
              <button type="button" className="username-dialog-cancel" onClick={() => setShowUsernameDialog(false)}>
                Batal
              </button>
              <button type="submit" className="username-dialog-save" disabled={!usernameDraft.trim()}>
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
