import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { API_BASE_URL } from '../config'

const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024
const MAX_LOCAL_FILE_SIZE = 25 * 1024 * 1024
const BACKEND_URL = API_BASE_URL

interface StagedFile {
  id: string
  name: string
  size: string
  rawSize: number
  rawFile: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface FileDropzoneProps {
  selectedDeviceName?: string
  onSendFiles?: (files: File[]) => void
  onUploadComplete?: (fileName: string, fileSize: string, rawSize: number) => void
  transportMode?: 'server' | 'local'
  onPublishLocal?: (file: File) => Promise<{ ok: boolean; message?: string }> | { ok: boolean; message?: string }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function encodeFileName(name: string): string {
  return encodeURIComponent(name)
}

export function FileDropzone({
  selectedDeviceName = 'Semua Perangkat Terdekat',
  onSendFiles,
  onUploadComplete,
  transportMode = 'server',
  onPublishLocal,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [sizeErrors, setSizeErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map())

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (files: File[]) => {
    const errors: string[] = []
    const valid: StagedFile[] = []
    const maxSize = transportMode === 'local' ? MAX_LOCAL_FILE_SIZE : MAX_FILE_SIZE

    for (const file of files) {
      if (file.size > maxSize) {
        const limitLabel = transportMode === 'local' ? '25 MiB' : '3 GB'
        errors.push(`"${file.name}" melebihi batas ${limitLabel} (${formatBytes(file.size)})`)
      } else {
        valid.push({
          id: `${file.name}-${file.lastModified}-${Math.random()}`,
          name: file.name,
          size: formatBytes(file.size),
          rawSize: file.size,
          rawFile: file,
          progress: 0,
          status: 'pending',
        })
      }
    }

    setSizeErrors(errors)
    if (valid.length > 0) {
      setStagedFiles((prev) => [...prev, ...valid])
    }
  }

  const handleRemoveFile = (id: string) => {
    const xhr = xhrRefs.current.get(id)
    if (xhr) {
      xhr.abort()
      xhrRefs.current.delete(id)
    }
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFile = useCallback((staged: StagedFile) => {
    setStagedFiles((prev) =>
      prev.map((f) => f.id === staged.id ? { ...f, status: 'uploading', progress: 0 } : f)
    )

    if (transportMode === 'local') {
      void (async () => {
        try {
          if (!onPublishLocal) throw new Error('Mesin transfer lokal belum siap. Muat ulang halaman dan coba lagi.')
          const result = await onPublishLocal(staged.rawFile)
          if (!result.ok) throw new Error(result.message || 'File gagal disediakan di jaringan lokal.')
          setStagedFiles((prev) => prev.map((f) => f.id === staged.id ? { ...f, status: 'done', progress: 100 } : f))
          onUploadComplete?.(staged.name, staged.size, staged.rawSize)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Gagal menyediakan file di jaringan lokal.'
          setStagedFiles((prev) => prev.map((f) => f.id === staged.id ? { ...f, status: 'error', error: message } : f))
        }
      })()
      return
    }

    const xhr = new XMLHttpRequest()
    xhrRefs.current.set(staged.id, xhr)

    xhr.open('POST', `${BACKEND_URL}/api/upload`, true)
    xhr.setRequestHeader('X-File-Name', encodeFileName(staged.name))

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        setStagedFiles((prev) =>
          prev.map((f) => f.id === staged.id ? { ...f, progress: pct } : f)
        )
      }
    }

    xhr.onload = () => {
      xhrRefs.current.delete(staged.id)
      if (xhr.status === 200) {
        setStagedFiles((prev) =>
          prev.map((f) => f.id === staged.id ? { ...f, status: 'done', progress: 100 } : f)
        )
        onUploadComplete?.(staged.name, staged.size, staged.rawSize)
      } else if (xhr.status === 413) {
        let msg = 'Ukuran file melebihi batas 3 GB'
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.error) msg = body.error
        } catch {}
        setStagedFiles((prev) =>
          prev.map((f) => f.id === staged.id
            ? { ...f, status: 'error', error: msg }
            : f)
        )
      } else {
        let msg = 'Upload gagal'
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.error) msg = body.error
        } catch {}
        setStagedFiles((prev) =>
          prev.map((f) => f.id === staged.id
            ? { ...f, status: 'error', error: msg }
            : f)
        )
      }
    }

    xhr.onerror = () => {
      xhrRefs.current.delete(staged.id)
      setStagedFiles((prev) =>
        prev.map((f) => f.id === staged.id
          ? { ...f, status: 'error', error: 'Koneksi ke backend gagal. Pastikan server berjalan di port 8080.' }
          : f)
      )
    }

    xhr.onabort = () => {
      xhrRefs.current.delete(staged.id)
    }

    const formData = new FormData()
    formData.append('file', staged.rawFile)
    xhr.send(formData)
  }, [onUploadComplete, onPublishLocal, transportMode])

  const handleSend = () => {
    const pending = stagedFiles.filter((f) => f.status === 'pending')
    if (pending.length === 0) return
    if (transportMode === 'server') onSendFiles?.(pending.map((f) => f.rawFile))
    for (const f of pending) uploadFile(f)
  }

  const hasPending = stagedFiles.some((f) => f.status === 'pending')
  const allDone = stagedFiles.length > 0 && stagedFiles.every((f) => f.status === 'done' || f.status === 'error')

  return (
    <div className="dropzone-container w-full max-w-full box-border">
      {sizeErrors.length > 0 && (
        <div className="dropzone-size-error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>File Ditolak — Ukuran Melebihi 3 GB</strong>
            <ul className="dropzone-error-list">
              {sizeErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
          <button
            type="button"
            className="dropzone-error-dismiss"
            onClick={() => setSizeErrors([])}
          >✕</button>
        </div>
      )}

      <div
        className={`dropzone-box p-4 sm:p-6 ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        <div className="dropzone-icon-circle">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 16 4-4 4 4" />
          </svg>
        </div>

        <div className="dropzone-text-group">
          <h3>Tarik dan lepas file ke sini untuk mentransfer</h3>
          <p>atau klik untuk menjelajah file dari perangkat lokal Anda.</p>
          <div className="dropzone-limit-hint">
            Tujuan: <strong style={{ color: '#c4b5fd' }}>{selectedDeviceName}</strong> • Maks. <strong>{transportMode === 'local' ? '25 MiB' : '3 GB'}</strong> per file
          </div>
        </div>

        <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Pilih Berkas
          </button>
        </div>
      </div>

      {stagedFiles.length > 0 && (
        <div className="staged-files-container">
          <div className="staged-header">
            <span className="staged-title">
              Berkas Siap Dikirim ({stagedFiles.length})
            </span>
            {!allDone && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => {
                  for (const f of stagedFiles) {
                    const xhr = xhrRefs.current.get(f.id)
                    if (xhr) xhr.abort()
                  }
                  xhrRefs.current.clear()
                  setStagedFiles([])
                }}
              >
                Batalkan Semua
              </button>
            )}
            {allDone && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                onClick={() => setStagedFiles([])}
              >
                Bersihkan
              </button>
            )}
          </div>

          <div className="staged-list">
            {stagedFiles.map((file) => (
              <div key={file.id} className={`staged-item${file.status === 'error' ? ' staged-item--error' : ''}`}>
                <div className="staged-item-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="staged-file-name">{file.name}</div>
                    <div className="staged-file-size">{file.size}</div>

                    {(file.status === 'uploading' || file.status === 'done') && (
                      <div className="staged-upload-progress">
                        <div className="staged-progress-track">
                          <div
                            className={`staged-progress-fill${file.status === 'done' ? ' staged-progress-fill--done' : ''}`}
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <span className="staged-progress-label">
                          {file.status === 'done' ? (transportMode === 'local' ? '✓ Tersedia' : '✓ Selesai') : `${file.progress}%`}
                        </span>
                      </div>
                    )}

                    {file.status === 'error' && (
                      <div className="staged-upload-error">{file.error}</div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-remove-file"
                  title="Hapus berkas"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(file.id)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {hasPending && (
            <div className="staged-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSend}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {transportMode === 'local' ? `Sediakan ke ${selectedDeviceName}` : `Kirim ke ${selectedDeviceName}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FileDropzone
