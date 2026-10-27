import { useState } from 'react'
import type { Device, DeviceType } from '../types/index.ts'

interface ConnectedDevicesProps {
  devices?: Device[]
  selectedDeviceId?: string | null
  onSelectDevice?: (device: Device) => void
}

const DEFAULT_MOCK_DEVICES: Device[] = [
  {
    id: 'dev-1',
    name: 'MacBook Pro M2 (Perangkat Ini)',
    type: 'laptop',
    ip: '192.168.1.104',
    status: 'online',
    os: 'macOS Sonoma',
    isSelf: true,
  },
  {
    id: 'dev-2',
    name: 'Workstation Alpha',
    type: 'desktop',
    ip: '192.168.1.115',
    status: 'online',
    os: 'Windows 11 Pro',
  },
  {
    id: 'dev-3',
    name: 'Galaxy S24 Ultra',
    type: 'phone',
    ip: '192.168.1.142',
    status: 'online',
    os: 'Android 14',
  },
  {
    id: 'dev-4',
    name: 'iPad Pro 11"',
    type: 'tablet',
    ip: '192.168.1.188',
    status: 'idle',
    os: 'iPadOS 17',
  },
  {
    id: 'dev-5',
    name: 'Home Server Linux',
    type: 'desktop',
    ip: '192.168.1.200',
    status: 'busy',
    os: 'Ubuntu 24.04 LTS',
  },
]

function DeviceTypeIcon({ type }: { type: DeviceType }) {
  if (type === 'phone') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    )
  }

  if (type === 'tablet') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
        <line x1="12" x2="12.01" y1="18" y2="18" />
      </svg>
    )
  }

  if (type === 'laptop') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}

export function ConnectedDevices({
  devices = DEFAULT_MOCK_DEVICES,
  selectedDeviceId,
  onSelectDevice,
}: ConnectedDevicesProps) {
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = () => {
    setIsScanning(true)
    setTimeout(() => {
      setIsScanning(false)
    }, 1200)
  }

  const activeCount = devices.filter((d) => d.status === 'online').length

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
            <line x1="2" x2="22" y1="20" y2="20" />
          </svg>
          <h2 className="panel-title">Perangkat Terhubung</h2>
          <span className="panel-badge">{activeCount} Aktif</span>
        </div>
        <button
          type="button"
          className="action-btn"
          onClick={handleScan}
          disabled={isScanning}
          title="Pindai jaringan lokal"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isScanning ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>{isScanning ? 'Memindai...' : 'Pindai'}</span>
        </button>
      </div>

      <div className="devices-list">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id

          return (
            <div
              key={device.id}
              className={`device-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="device-main-info">
                <div className="device-avatar">
                  <DeviceTypeIcon type={device.type} />
                </div>
                <div className="device-texts">
                  <div className="device-name-row">
                    <span className="device-name">{device.name}</span>
                    {device.isSelf && (
                      <span className="device-self-badge">Anda</span>
                    )}
                  </div>
                  <div className="device-meta-row">
                    <span className="device-type-tag">{device.type}</span>
                    <span>•</span>
                    <span className="device-ip-tag">{device.ip}</span>
                    <span>•</span>
                    <span className="device-status-badge">
                      <span className={`status-dot ${device.status}`} />
                      <span className={`status-text ${device.status}`}>
                        {device.status === 'online'
                          ? 'Online'
                          : device.status === 'idle'
                          ? 'Siaga'
                          : 'Sibuk'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="device-actions">
                {!device.isSelf && (
                  <button
                    type="button"
                    className="btn-device-action"
                    onClick={() => onSelectDevice?.(device)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span>Kirim</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {devices.length === 0 && (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>Tidak ada perangkat terdeteksi dalam jaringan lokal.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectedDevices
