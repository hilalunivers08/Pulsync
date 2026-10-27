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
