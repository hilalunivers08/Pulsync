import { useState } from 'react'
import type { TransferItem, TransferStatus } from '../types/index.ts'

interface RecentTransfersProps {
  transfers?: TransferItem[]
  onClearHistory?: () => void
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

export function RecentTransfers({
  transfers = DEFAULT_MOCK_TRANSFERS,
  onClearHistory,
}: RecentTransfersProps) {
  const [items, setItems] = useState<TransferItem[]>(transfers)

  const handleClear = () => {
    setItems([])
    onClearHistory?.()
  }

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <h2 className="panel-title">Riwayat Transfer</h2>
          <span className="panel-badge">{items.length} Berkas</span>
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
        {items.map((item) => (
          <div key={item.id} className="transfer-item">
            <div className="transfer-top-row">
              <div className="transfer-file-group">
                <div className="transfer-file-icon">
                  <FileTypeIcon fileName={item.fileName} />
                </div>
                <div className="transfer-file-meta">
                  <span className="transfer-file-name" title={item.fileName}>
                    {item.fileName}
                  </span>
                  <div className="transfer-subtext">
                    <span>{item.fileSize}</span>
                    <span>•</span>
                    <span className="transfer-target">
                      {item.direction === 'upload' ? 'ke' : 'dari'} {item.targetDevice}
                    </span>
                  </div>
                </div>
              </div>

              <div className="transfer-status-group">
                <StatusBadge status={item.status} />
                {item.speed && (
                  <span className="transfer-speed">{item.speed}</span>
                )}
              </div>
            </div>

            <div className="transfer-progress-wrapper">
              <div className="progress-track">
                <div
                  className={`progress-fill ${item.status}`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="progress-info-row">
                <span>{item.timestamp}</span>
                <span className="progress-percent">{item.progress}%</span>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p>Belum ada riwayat transfer file.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentTransfers
