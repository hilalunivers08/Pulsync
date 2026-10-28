# Pulsync UI changes

## What changed
- The header dropdown is layered above the dropzone and does not take up layout space.
- Removed the “Perangkat ini” block and all separator lines from the dropdown.
- “Set username” opens a branded popup; saving updates `localStorage` and device presence.
- The theme toggle remains in the dropdown.
- “Contact me” opens the separate `/contact` page.

## Manual edits

### Contact links and text
Edit `src/pages/ContactPage.tsx`. The `CONTACT_LINKS` array near the top contains the label, description, displayed contact detail, and destination URL for every card. Replace `USERNAME` and `EMAIL_KAMU@example.com` with your own details. Add or remove entries in the same array as needed.

### Contact page design
Edit `src/styles/contact-page.css`. It uses the existing project variables and fonts (`--font-family`, `--font-heading`, and the yellow/purple/cyan palette), so the original visual style is preserved.

### Dropdown and its stacking position
Edit the `.dashboard-header`, `.header-menu-popover`, and `.header-menu-item` rules in `src/styles/dashboard.css`.

### Username popup and menu actions
Edit `src/App.tsx`. Search for `handleSetUsername`, `handleSaveUsername`, and `header-menu-popover`.

### `/contact` route
`src/main.tsx` selects `ContactPage` when the pathname is `/contact`. The page uses a regular link back to `/` for the file-transfer dashboard.

## Mobile layout, clearing shared files, and file order
- At widths of 520px and below, dashboard panels use a single-column layout, narrower padding, and wrapping metadata/actions so device and available-file cards stay within the viewport.
- “Bersihkan” sends `DELETE /api/files`. The Go backend removes the shared-file records and deletes the stored files; in-progress downloads are allowed to finish before their files are removed. The action affects the shared list for every device using the same backend.
- Upload responses now include `created_at`, and `GET /api/files` sorts by that timestamp descending. The newest upload appears first and the oldest appears lower in the list.

### Backend location
The `DELETE /api/files` handler and newest-first ordering are in `backend/main.go`, inside `filesListHandler`. The timestamp is assigned in `uploadHandler`.

### Mobile styles
The narrow-screen layout rules are at the end of `src/styles/dashboard.css` under “Compact layouts”.

## Local-only WebRTC transfer integration
- The original dashboard layout is preserved: header, username/theme menu, existing file dropzone, connected-device panel, and local-file panel remain in their original positions. The local WebRTC client runs in a hidden same-origin iframe so its standalone experimental UI does not replace the dashboard.
- The existing dropzone now publishes files through the local WebRTC engine instead of uploading file contents to `/api/upload`. Discovered peers populate the existing device panel; own/remote/received local files populate the existing local-file panel. The parent passes the API base URL, username, and theme to the hidden engine.
- The active client assets are in `public/poc/discovery/index.html` so Vite copies them to `dist`.
- The Go backend now registers `/api/p2p/hello`, `/api/p2p/peers`, `/api/p2p/signal`, `/api/p2p/signals`, and `/api/p2p/leave` from `backend/p2p_signaling.go`. The signaling routes use the same port 8080 as the existing backend, so the separate PoC server on port 8081 is no longer needed for the integrated dashboard.
- `VITE_API_BASE_URL` can point the frontend at a different API origin. By default, the API hostname follows the browser hostname and uses port 8080.
- The original standalone PoC remains in `poc/discovery` for reference and repeatable experiments.

### Important scope note
The signaling and local-transfer client are integrated while preserving the original dashboard presentation, but this remains an early experimental integration. The IP network bucket is a matching heuristic, not definitive LAN verification. Do not expose the backend publicly until signaling rate limits, abuse protections, proxy trust, HTTPS, cross-browser behavior, and LAN-only behavior have been hardened and tested.

## 2026-10-28 — Reconnect, transfer feedback, and dark mode refinements

- The hidden local-transfer engine now re-checks peers when the page becomes visible and can restart after a BFCache/page lifecycle pause.
- Stale or disconnected WebRTC connections are cleaned up and retried instead of permanently blocking a new offer for the same peer ID.
- Download requests have visible states, a timeout/error message if the source never responds, a receiving state, and a completion notice.
- Rejections that occur while the receiver is preparing a file clear the request state immediately, instead of leaving the UI stuck on “Meminta…”.
- The “Simpan ke perangkat” action now starts the download inside the same-origin transfer iframe that owns the Blob URL.
- Dark mode uses near-white dashed borders and card shadows, switches headings to Plus Jakarta Sans for a calmer typographic hierarchy, and changes text to dark ink when staged/transfer cards turn white on hover.
- Automated checks: inline JavaScript syntax, TSX parse syntax, Go tests, and `go vet` pass. A complete Vite/TypeScript build could not be verified because npm registry requests failed with DNS `EAI_AGAIN` in the build environment.
