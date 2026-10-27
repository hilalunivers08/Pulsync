import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ContactPage from './pages/ContactPage.tsx'

const isContactPage = window.location.pathname.replace(/\/+$/, '') === '/contact'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isContactPage ? <ContactPage /> : <App />}
  </StrictMode>,
)
