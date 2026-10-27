import { useEffect } from 'react'

interface ContactModalProps {
  open: boolean
  onClose: () => void
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', onKey)
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)', padding: '24px', width: '90%', maxWidth: '420px', position: 'relative' }}>
        <button type="button" onClick={onClose} style={{ position: 'absolute', right: '12px', top: '12px', background: '#FACC15', border: '2px solid #000', boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)', padding: '4px 8px' }}>X</button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>Contact Me</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href="https://wa.me/" target="_blank" rel="noreferrer" style={{ padding: '10px 12px', border: '2px solid #000', boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)', background: '#FACC15', textDecoration: 'none', color: '#000', fontWeight: 700 }}>WhatsApp</a>
          <a href="https://github.com/" target="_blank" rel="noreferrer" style={{ padding: '10px 12px', border: '2px solid #000', boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)', background: '#FACC15', textDecoration: 'none', color: '#000', fontWeight: 700 }}>GitHub</a>
          <a href="https://instagram.com/" target="_blank" rel="noreferrer" style={{ padding: '10px 12px', border: '2px solid #000', boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)', background: '#FACC15', textDecoration: 'none', color: '#000', fontWeight: 700 }}>Instagram</a>
          <a href="https://tiktok.com/@" target="_blank" rel="noreferrer" style={{ padding: '10px 12px', border: '2px solid #000', boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)', background: '#FACC15', textDecoration: 'none', color: '#000', fontWeight: 700 }}>TikTok</a>
          <a href="mailto:example@gmail.com" style={{ padding: '10px 12px', border: '2px solid #000', boxShadow: '3px 3px 0px 0px rgba(0,0,0,1)', background: '#FACC15', textDecoration: 'none', color: '#000', fontWeight: 700 }}>Gmail</a>
        </div>
      </div>
    </div>
  )
}
