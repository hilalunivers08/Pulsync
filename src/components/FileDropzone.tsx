import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'

interface StagedFile {
  id: string
  name: string
  size: string
  rawFile: File
}

interface FileDropzoneProps {
  selectedDeviceName?: string
  onSendFiles?: (files: File[]) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FileDropzone({
  selectedDeviceName = 'Semua Perangkat Terdekat',
  onSendFiles,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
    const newStaged: StagedFile[] = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      size: formatBytes(file.size),
      rawFile: file,
    }))

    setStagedFiles((prev) => [...prev, ...newStaged])
  }

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSend = () => {
    if (stagedFiles.length === 0) return
    onSendFiles?.(stagedFiles.map((sf) => sf.rawFile))
    setStagedFiles([])
  }

  return (
    <div className="dropzone-container">
      <div
        className={`dropzone-box ${isDragging ? 'is-dragging' : ''}`}
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
          <p>
            atau klik untuk menjelajah file dari perangkat lokal Anda.
          </p>
          <div className="dropzone-limit-hint">
            Tujuan: <strong style={{ color: '#c4b5fd' }}>{selectedDeviceName}</strong> • Maks. file tak terbatas
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
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => setStagedFiles([])}
            >
              Batalkan Semua
            </button>
          </div>

          <div className="staged-list">
            {stagedFiles.map((file) => (
              <div key={file.id} className="staged-item">
                <div className="staged-item-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div>
                    <div className="staged-file-name">{file.name}</div>
                    <div className="staged-file-size">{file.size}</div>
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
              Kirim ke {selectedDeviceName}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileDropzone
