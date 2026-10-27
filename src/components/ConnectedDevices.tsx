import { useEffect, useState } from 'react'
import type { Device, DeviceType } from '../types/index.ts'
import { API_BASE_URL } from '../config'

interface ConnectedDevicesProps {
  devices?: Device[]
  selectedDeviceId?: string | null
  onSelectDevice?: (device: Device) => void
}

interface ApiDevice {
  ip: string
  name: string
  last_seen: string
  status: string
}

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
  devices: _devices,
  selectedDeviceId,
  onSelectDevice,
}: ConnectedDevicesProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [selfIp, setSelfIp] = useState<string>('')

  useEffect(() => {
    const sendPresence = async () => {
      try {
        const username = localStorage.getItem('pulsync_username') || ''
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
    sendPresence()
    const presenceInterval = setInterval(sendPresence, 3000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendPresence()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(presenceInterval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/devices`)
        if (res.ok) {
          const data: ApiDevice[] = await res.json()
          const mapped: Device[] = data.map((d, idx) => ({
            id: d.ip + idx,
            name: d.name,
            type: d.name.toLowerCase().includes('android') || d.name.toLowerCase().includes('ios') ? 'phone' : d.name.toLowerCase().includes('ipad') || d.name.toLowerCase().includes('tablet') ? 'tablet' : d.name.toLowerCase().includes('windows') || d.name.toLowerCase().includes('mac') || d.name.toLowerCase().includes('laptop') ? 'laptop' : 'desktop',
            ip: d.ip,
            status: d.status === 'online' ? 'online' : 'idle',
            isSelf: selfIp === d.ip
          }))
          setDevices(mapped)
        }
      } catch (e) {
        // ignore
      }
    }
    fetchDevices()
    const deviceInterval = setInterval(fetchDevices, 3000)
    return () => clearInterval(deviceInterval)
  }, [selfIp])

  useEffect(() => {
    try {
      const hostname = window.location.hostname
      if (hostname) {
        setSelfIp(hostname)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  const activeCount = devices.filter((d) => d.status === 'online').length

  return (
    <div className="glass-panel w-full max-w-full box-border">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
            <line x1="2" x2="22" y1="20" y2="20" />
          </svg>
          <h2 className="panel-title">Perangkat Terhubung</h2>
          <span className="panel-badge">{activeCount} Aktif</span>
        </div>
      </div>

      <div className="devices-list">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id

          return (
            <div
              key={device.id}
              className={`device-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div className="device-main-info min-w-0 flex-1">
                <div className="device-avatar">
                  <DeviceTypeIcon type={device.type} />
                </div>
                <div className="device-texts min-w-0 flex-1">
                  <div className="device-name-row">
                    <span className="device-name truncate break-all">{device.name}</span>
                    {(device.isSelf || selfIp === device.ip) && (
                      <span className="device-self-badge">ANDA</span>
                    )}
                  </div>
                  <div className="device-meta-row">
                    <span className="device-type-tag">{device.type}</span>
                    <span>•</span>
                    <span className="device-ip-tag truncate break-all">{device.ip}</span>
                    <span>•</span>
                    <span className="device-status-badge">
                      <span className={`status-dot ${device.status === 'online' ? 'online' : 'idle'}`} />
                      <span className={`status-text ${device.status === 'online' ? 'online' : 'idle'}`}>
                        {device.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="device-actions">
                {!(device.isSelf || selfIp === device.ip) && (
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
