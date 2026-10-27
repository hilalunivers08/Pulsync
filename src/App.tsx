import { useEffect, useState } from 'react'
import './styles/index.css'
import { PulsarBackground } from './components/PulsarBackground.tsx'
import { FileDropzone } from './components/FileDropzone.tsx'
import { ConnectedDevices } from './components/ConnectedDevices.tsx'
import { RecentTransfers } from './components/RecentTransfers.tsx'
import { ContactModal } from './components/ContactModal.tsx'
import type { Device, TransferItem } from './types/index.ts'
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

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [username, setUsername] = useState<string>(getInitialUsername())
  const [menuOpen, setMenuOpen] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem('pulsync_theme') || 'dark'
  })
  const [transfers, setTransfers] = useState<TransferItem[]>([
    {
      id: 'tr-1',
      fileName: 'design-system-v2.fig',
      fileSize: '124.6 MB',
      progress: 100,
      status: 'completed',
      direction: 'upload',
      speed: '48.2 MB/s',
      targetDevice: 'Workstation Alpha',
      timestamp: '2 menit yang lalu',
    },
    {
      id: 'tr-2',
      fileName: 'docker-compose.production.yml',
      fileSize: '4.8 KB',
      progress: 100,
      status: 'completed',
      direction: 'download',
      speed: '1.2 MB/s',
      targetDevice: 'Home Server Linux',
      timestamp: '8 menit yang lalu',
    },
    {
      id: 'tr-3',
      fileName: 'dataset_model_weights.bin',
      fileSize: '1.85 GB',
      progress: 68,
      status: 'in_progress',
      direction: 'upload',
      speed: '54.1 MB/s',
      targetDevice: 'Workstation Alpha',
      timestamp: 'Sedang berlangsung',
    },
    {
      id: 'tr-4',
      fileName: 'raw_footage_4k_scene1.mp4',
      fileSize: '4.20 GB',
      progress: 32,
      status: 'in_progress',
      direction: 'download',
      speed: '62.8 MB/s',
      targetDevice: 'iPad Pro 11"',
      timestamp: 'Sedang berlangsung',
    },
  ])

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device)
  }

  const handleSendFiles = (files: File[]) => {
    const targetName = selectedDevice ? selectedDevice.name : 'Jaringan Lokal'
    const newItems: TransferItem[] = files.map((file) => ({
      id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      progress: 0,
      status: 'in_progress',
      direction: 'upload',
      speed: '— MB/s',
      targetDevice: targetName,
      timestamp: 'Sedang berlangsung',
    }))

    setTransfers((prev) => [...newItems, ...prev])
  }

  const handleUploadComplete = (fileName: string, fileSize: string, _rawSize: number) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.fileName === fileName && t.status === 'in_progress'
          ? { ...t, fileSize, progress: 100, status: 'completed', speed: '—', timestamp: 'Baru saja' }
          : t
      )
    )
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

  const handleSetUsername = () => {
    const input = prompt('Set Username', username)
    if (input !== null && input.trim() !== '') {
      const newName = input.trim()
      setUsername(newName)
      localStorage.setItem('pulsync_username', newName)
      setMenuOpen(false)
      sendPresenceInstant()
    }
  }

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    setMenuOpen(false)
  }

  const handleContact = () => {
    setMenuOpen(false)
    setShowContact(true)
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

          <div className="header-status-group">
            <div className="network-pill">
              <span className="pulse-dot" />
              <span>P2P Mesh Aktif</span>
            </div>
            <div className="network-pill" style={{ fontFamily: 'var(--font-mono)' }}>
              <span>IP: {typeof window !== 'undefined' ? window.location.hostname : '...'}</span>
            </div>
          </div>
        </header>

        <section>
          <FileDropzone
            selectedDeviceName={selectedDevice ? selectedDevice.name : 'Semua Perangkat'}
            onSendFiles={handleSendFiles}
            onUploadComplete={handleUploadComplete}
          />
        </section>

        <main className="dashboard-grid flex flex-col lg:flex-row w-full gap-4">
          <div className="w-full lg:w-1/2">
            <ConnectedDevices
              selectedDeviceId={selectedDevice?.id}
              onSelectDevice={handleSelectDevice}
            />
          </div>
          <div className="w-full lg:w-1/2">
            <RecentTransfers transfers={transfers} />
          </div>
        </main>
      </div>
      <ContactModal open={showContact} onClose={() => setShowContact(false)} />
    </div>
  )
}

export default App
