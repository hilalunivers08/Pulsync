import { useEffect, useRef, useState } from 'react'
import type { TransferItem } from '../types/index.ts'
import { API_BASE_URL } from '../config'

export interface LocalTransferFileView {
  id: string
  key: string
  original_name: string
  file_size: number
  expires_at?: string
  active_downloads: number
  source_name: string
  kind: 'published' | 'available'
  can_download?: boolean
  pending?: boolean
  deleting?: boolean
  pending_stage?: string
  receiving?: boolean
  status_message?: string
  status_level?: string
}

interface RecentTransfersProps {
  transfers?: TransferItem[]
  onClearHistory?: () => void
  localFiles?: LocalTransferFileView[]
  onDownloadLocalFile?: (key: string) => void
  onRemoveLocalFile?: (id: string) => void
  onClearLocalFiles?: () => void
}

interface SharedFileItem {
  id: string
  original_name: string
  file_size: number
  expires_at: string
  created_at?: string
  active_downloads: number
  download_url: string
}

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
  onClearHistory,
  localFiles,
  onDownloadLocalFile,
  onRemoveLocalFile,
  onClearLocalFiles,
}: RecentTransfersProps) {
  const isLocalMode = localFiles !== undefined;
  const [sharedFiles, setSharedFiles] = useState<SharedFileItem[]>([])
  const [isClearing, setIsClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => {
    if (isLocalMode) return
    const fetchSharedFiles = async () => {
      const version = requestVersion.current
      try {
        const res = await fetch(`${API_BASE_URL}/api/files`)
        if (res.ok) {
          const data: SharedFileItem[] = await res.json()
          // Guard against an older polling response restoring files after Clear finishes.
          if (version === requestVersion.current && Array.isArray(data)) {
            setSharedFiles([...data].sort((a, b) => {
              const aTime = a.created_at ? Date.parse(a.created_at) : Number.NaN
              const bTime = b.created_at ? Date.parse(b.created_at) : Number.NaN
              if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime
              return 0 // Keep API order if talking to an older backend.
            }))
          }
        }
      } catch {
        // Keep the last successful list while the backend is temporarily unavailable.
      }
    }
    fetchSharedFiles()
    const interval = setInterval(fetchSharedFiles, 3000)
    return () => clearInterval(interval)
  }, [isLocalMode])

  const handleClear = async () => {
    if (isLocalMode) {
      if ((localFiles || []).length > 0) onClearLocalFiles?.()
      return
    }
    if (isClearing || sharedFiles.length === 0) return

    setIsClearing(true)
    setClearError('')
    // Invalidate any GET request that began before this clear operation.
    requestVersion.current += 1
    try {
      const res = await fetch(`${API_BASE_URL}/api/files`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(`Server merespons ${res.status}`)
      }
      // Invalidate requests started while DELETE was in flight.
      requestVersion.current += 1
      setSharedFiles([])
      onClearHistory?.()
    } catch (error) {
      console.error('Gagal membersihkan berkas tersedia:', error)
      setClearError('Berkas belum bisa dibersihkan. Pastikan backend Pulsync sedang berjalan.')
      // Refresh from the server so the screen reflects the actual state.
      requestVersion.current += 1
      try {
        const res = await fetch(`${API_BASE_URL}/api/files`)
        if (res.ok) {
          const data: SharedFileItem[] = await res.json()
          if (Array.isArray(data)) setSharedFiles(data)
        }
      } catch {
        // Keep the error message visible.
      }
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="glass-panel recent-files-panel w-full max-w-full box-border">
      <div className="panel-header">
        <div className="panel-title-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <h2 className="panel-title">Berkas tersedia di Wi-Fi Lokal</h2>
          <span className="panel-badge">{isLocalMode ? (localFiles?.length || 0) : sharedFiles.length} Berkas</span>
        </div>
        {(isLocalMode ? (localFiles || []).length > 0 : sharedFiles.length > 0) && (
          <button
            type="button"
            className="action-btn"
            onClick={handleClear}
            disabled={isClearing}
            title="Hapus semua berkas yang tersedia di jaringan lokal"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <span>{isClearing ? 'Membersihkan…' : 'Bersihkan'}</span>
          </button>
        )}
      </div>

      {clearError && <p className="clear-files-error" role="status">{clearError}</p>}

      <div className="transfers-list">
        {isLocalMode && (localFiles || []).map((file) => (
          <div key={`${file.kind}:${file.key}`} className="transfer-item">
            <div className="transfer-top-row">
              <div className="transfer-file-group">
                <div className="transfer-file-icon"><FileTypeIcon fileName={file.original_name} /></div>
                <div className="transfer-file-meta min-w-0 flex-1">
                  <span className="transfer-file-name truncate break-all" title={file.original_name}>{file.original_name}</span>
                  <div className="transfer-subtext local-transfer-subtext" title={`${formatBytes(file.file_size)} · ${file.source_name}${file.expires_at ? ` · ${new Date(file.expires_at).toLocaleTimeString()}` : ''}`}>
                    <span className="transfer-meta-size">{formatBytes(file.file_size)}</span>
                    <span className="transfer-meta-separator" aria-hidden="true">•</span>
                    <span className="transfer-meta-source" title={file.source_name}>{file.source_name}</span>
                    {file.expires_at && <><span className="transfer-meta-separator" aria-hidden="true">•</span><span className="transfer-meta-time"><CountdownTimer expiresAt={file.expires_at} /></span></>}
                  </div>
                </div>
              </div>
              <div className="transfer-status-group">
                {file.kind === 'published' && (
                  <button type="button" className="action-btn" onClick={() => onRemoveLocalFile?.(file.id)} title="Hapus file sementara">Hapus</button>
                )}
                {file.kind === 'available' && (
                  <>
                    <button type="button" className="action-btn local-download-btn" disabled={!file.can_download || file.pending || file.receiving || file.deleting} onClick={() => onDownloadLocalFile?.(file.key)}>
                      {file.deleting ? 'Menghapus…' : file.receiving ? 'Mengunduh…' : file.pending ? 'Menyiapkan…' : file.can_download ? 'Unduh' : 'Sumber offline'}
                    </button>
                    <button type="button" className="action-btn" disabled={file.deleting} onClick={() => onRemoveLocalFile?.(file.id)} title="Hapus berkas dari jaringan lokal">
                      {file.deleting ? 'Menghapus…' : 'Hapus'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {file.kind === 'available' && file.status_message && <div className={`local-file-status ${file.status_level || 'info'}`}>{file.status_message}</div>}
          </div>
        ))}
        {!isLocalMode && sharedFiles.map((file) => (
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

        {(isLocalMode ? (localFiles || []).length === 0 : sharedFiles.length === 0) && (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p>{isLocalMode ? 'Belum ada file sementara di jaringan lokal.' : 'Belum ada berkas tersedia di jaringan Wi-Fi.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentTransfers
