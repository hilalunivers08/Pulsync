import { useEffect, useState } from 'react'
import type { TransferItem, TransferStatus } from '../types/index.ts'
import { API_BASE_URL } from '../config'

interface RecentTransfersProps {
  transfers?: TransferItem[]
  onClearHistory?: () => void
}

interface SharedFileItem {
  id: string
  original_name: string
  file_size: number
  expires_at: string
  active_downloads: number
  download_url: string
}

const DEFAULT_MOCK_TRANSFERS: TransferItem[] = [
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
  {
    id: 'tr-5',
    fileName: 'firmware-update-v1.4.bin',
    fileSize: '64.0 MB',
    progress: 42,
    status: 'failed',
    direction: 'upload',
    speed: '0 KB/s',
    targetDevice: 'Galaxy S24 Ultra',
    timestamp: '15 menit yang lalu',
  },
]

function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  if (['mp4', 'mov', 'mkv', 'avi'].includes(ext)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect width="15" height="14" x="1" y="5" rx="2" ry="2" />
      </svg>
    )
  }

  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8v13H3V8" />
        <path d="M1 3h22v5H1z" />
        <path d="M10 12h4" />
      </svg>
    )
  }

  if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function StatusBadge({ status }: { status: TransferStatus }) {
  if (status === 'completed') {
    return (
      <span className="transfer-status-badge completed">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Selesai
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="transfer-status-badge in_progress">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Mentransfer
      </span>
    )
  }

  return (
    <span className="transfer-status-badge failed">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Gagal
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calculate = () => {
      const now = new Date().getTime()
      const exp = new Date(expiresAt).getTime()
      const diff = exp - now
      if (diff <= 0) {
        setTimeLeft('00:00')
        return
      }
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }
    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return <span>{timeLeft}</span>
}

export function RecentTransfers({
  transfers = DEFAULT_MOCK_TRANSFERS,
  onClearHistory,
}: RecentTransfersProps) {
  const [items, setItems] = useState<TransferItem[]>(transfers)
  const [sharedFiles, setSharedFiles] = useState<SharedFileItem[]>([])

  useEffect(() => {
    const fetchSharedFiles = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/files`)
        if (res.ok) {
          const data = await res.json()
          setSharedFiles(data)
        }
      } catch (e) {
        // ignore
      }
    }
    fetchSharedFiles()
    const interval = setInterval(fetchSharedFiles, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleClear = () => {
    setItems([])
    onClearHistory?.()
  }

  return (
    <div className="glass-panel w-full max-w-full box-border">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <h2 className="panel-title">Berkas tersedia di Wi-Fi Lokal</h2>
          <span className="panel-badge">{sharedFiles.length} Berkas</span>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            className="action-btn"
            onClick={handleClear}
            title="Bersihkan riwayat transfer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <span>Bersihkan</span>
          </button>
        )}
      </div>

      <div className="transfers-list">
        {sharedFiles.map((file) => (
          <div key={file.id} className="transfer-item">
            <div className="transfer-top-row">
              <div className="transfer-file-group">
                <div className="transfer-file-icon">
                  <FileTypeIcon fileName={file.original_name} />
                </div>
                <div className="transfer-file-meta min-w-0 flex-1">
                  <span className="transfer-file-name truncate break-all" title={file.original_name}>
                    {file.original_name}
                  </span>
                  <div className="transfer-subtext">
                    <span>{formatBytes(file.file_size)}</span>
                    <span>•</span>
                    <span>Sisa waktu: <CountdownTimer expiresAt={file.expires_at} /></span>
                    {file.active_downloads > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#f59e0b' }}>Sedang Diunduh</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="transfer-status-group">
                <a
                  href={`${API_BASE_URL}/api/download/${file.id}`}
                  className="action-btn"
                  style={{ textDecoration: 'none' }}
                  download
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Unduh</span>
                </a>
              </div>
            </div>
          </div>
        ))}

        {sharedFiles.length === 0 && (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p>Belum ada berkas tersedia di jaringan Wi-Fi.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentTransfers
