import { useState } from 'react'
import './styles/index.css'
import { PulsarBackground } from './components/PulsarBackground.tsx'
import { FileDropzone } from './components/FileDropzone.tsx'
import { ConnectedDevices } from './components/ConnectedDevices.tsx'
import { RecentTransfers } from './components/RecentTransfers.tsx'
import type { Device, TransferItem } from './types/index.ts'

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
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
      progress: 10,
      status: 'in_progress',
      direction: 'upload',
      speed: '38.4 MB/s',
      targetDevice: targetName,
      timestamp: 'Baru saja',
    }))

    setTransfers((prev) => [...newItems, ...prev])
  }

  return (
    <div className="pulsync-app-wrapper">
      <PulsarBackground />

      <div className="pulsync-app">
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
              <span>IP: 192.168.1.104</span>
            </div>
          </div>
        </header>

        <section>
          <FileDropzone
            selectedDeviceName={selectedDevice ? selectedDevice.name : 'Semua Perangkat'}
            onSendFiles={handleSendFiles}
          />
        </section>

        <main className="dashboard-grid">
          <ConnectedDevices
            selectedDeviceId={selectedDevice?.id}
            onSelectDevice={handleSelectDevice}
          />
          <RecentTransfers transfers={transfers} />
        </main>
      </div>
    </div>
  )
}

export default App
