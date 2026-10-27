import { useEffect } from 'react'
import { PulsarBackground } from '../components/PulsarBackground.tsx'
import '../styles/contact-page.css'

/*
 * EDIT KONTAK DI SINI.
 * Ganti href dengan URL akun atau alamat email milikmu.
 * Kamu juga bisa menambah atau menghapus item di array ini.
 */
const CONTACT_LINKS = [
  {
    label: 'GitHub',
    note: 'Source code dan project',
    detail: 'github.com/hilalunivers08',
    href: 'https://github.com/hilalunivers08',
    mark: 'GH',
  },
  {
    label: 'Instagram',
    note: 'Tambahkan akun Instagram kamu',
    detail: '@USERNAME',
    href: 'https://instagram.com/USERNAME',
    mark: 'IG',
  },
  {
    label: 'Email',
    note: 'Kirim pesan lewat email',
    detail: 'EMAIL_KAMU@example.com',
    href: 'mailto:EMAIL_KAMU@example.com',
    mark: '@',
  },
]

export default function ContactPage() {
  useEffect(() => {
    const theme = localStorage.getItem('pulsync_theme') || 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.title = 'Contact Me — Pulsync'
    return () => {
      document.title = 'Pulsync — High-Speed Peer File Transfer'
    }
  }, [])

  return (
    <div className="pulsync-app-wrapper contact-page-wrapper">
      <PulsarBackground />

      <main className="contact-page">
        <header className="contact-page-header">
          <a className="contact-page-brand" href="/" aria-label="Kembali ke Pulsync">
            <span className="contact-page-brand-icon" aria-hidden="true">✳</span>
            <span className="contact-page-brand-name">PULSYNC</span>
          </a>
          <a className="contact-back-link" href="/">← Kembali ke transfer</a>
        </header>

        <section className="contact-card">
          <p className="contact-eyebrow">PULSYNC / CONTACT</p>
          <h1>Contact Me</h1>
          <p className="contact-intro">Pilih salah satu kanal di bawah untuk terhubung.</p>

          <div className="contact-links">
            {CONTACT_LINKS.map((contact) => (
              <a
                className="contact-link-card"
                href={contact.href}
                key={contact.label}
                target={contact.href.startsWith('http') ? '_blank' : undefined}
                rel={contact.href.startsWith('http') ? 'noreferrer' : undefined}
              >
                <span className="contact-link-mark" aria-hidden="true">{contact.mark}</span>
                <span className="contact-link-copy">
                  <strong>{contact.label}</strong>
                  <span>{contact.note}</span>
                  <small>{contact.detail}</small>
                </span>
                <span className="contact-link-arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>

          <p className="contact-footer-note">Dibuat bersama Pulsync · Local-first file transfer</p>
        </section>
      </main>
    </div>
  )
}
