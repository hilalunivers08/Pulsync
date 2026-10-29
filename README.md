# Pulsync

Pulsync is a browser-based file transfer app built for devices on the same local network. Files are transferred peer-to-peer through WebRTC DataChannels; the Go backend handles peer discovery and WebRTC signaling, not file payloads, in the integrated local-transfer flow.

Repository: https://github.com/hilalunivers08/Pulsync

## Features

- Discover active Pulsync tabs on a matching local-network address bucket.
- Transfer files directly between browsers with WebRTC DataChannels.
- Publish files temporarily for nearby peers to request.
- Expire published files after 10 minutes, with early cleanup when all known recipients have been inactive for 10 seconds.
- Responsive dashboard with device status, transfer feedback, and light/dark themes.
- Keep the original REST file endpoints available for compatibility.

## Stack

- React 19, TypeScript, and Vite
- Go 1.22+
- WebRTC DataChannel for file transfer
- HTTP REST endpoints for peer discovery and signaling

## Requirements

- Node.js and npm
- Go 1.22 or newer
- Two or more devices on a network that permits direct peer-to-peer connections

## Run locally

Start the Go backend in one terminal:

```sh
cd backend
go run .
```

The backend listens on `0.0.0.0:8080`.

From the project root, start the frontend in a second terminal:

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Vite serves the frontend on port `5173`. On each device, open the same URL using the host computer's LAN IP, for example:

```text
http://192.168.1.4:5173
```

The frontend uses `http://<browser-hostname>:8080` as its default API base URL. Do not mix `localhost` with the LAN IP when testing between devices. If the OS firewall prompts for access, allow it only on a trusted private network.

## Configuration

Set `VITE_API_BASE_URL` when the API is hosted at a different origin:

```sh
VITE_API_BASE_URL=https://api.example.com npm run build
```

Vite embeds this value at build time, so rebuild and redeploy after changing it. Do not put secrets in this variable.

When the backend is behind a reverse proxy, set `PULSYNC_TRUST_PROXY=1` only if the proxy is trusted and overwrites `X-Forwarded-For`. Otherwise, leave it unset.

## Development commands

```sh
npm run dev       # Start the Vite development server
npm run build     # Type-check and build the frontend
npm run lint      # Run ESLint
npm run preview   # Preview the production build
```

Run backend tests from the backend directory:

```sh
cd backend
go test ./...
go vet ./...
```

## Transfer limits and behavior

The integrated browser-to-browser transfer flow currently enforces these limits:

- Maximum file size: 25 MiB per file
- Maximum published files: 50 MiB total
- Maximum retained incoming files: 50 MiB total
- Publication lifetime: up to 10 minutes
- Early cleanup: 10 seconds after all recipients that received the file listing become inactive

The sender's browser tab must remain open while a file is available. The backend does not store the file payload for this flow. A completed transfer is downloaded by the receiving browser.

The legacy `/api/upload` and `/api/files` endpoints remain in the Go backend for compatibility; they are separate from the integrated WebRTC transfer path.

## API overview

The Go backend listens on port `8080` and exposes the following endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Backend health check |
| `POST /api/p2p/hello` | Register a browser peer |
| `GET /api/p2p/peers` | Discover peers in the same network bucket |
| `POST /api/p2p/signal` | Submit an SDP offer or answer |
| `GET /api/p2p/signals` | Retrieve queued signaling messages |
| `POST /api/p2p/leave` | Remove a peer from discovery |
| `POST /api/upload` | Legacy upload endpoint |
| `GET /api/files` | List legacy shared files |
| `DELETE /api/files` | Clear legacy shared files |

## Project layout

```text
.
├── backend/                 # Go API and WebRTC signaling endpoints
├── public/poc/discovery/    # Browser-side WebRTC transfer client used by the dashboard
├── poc/discovery/           # Standalone discovery/transfer experiment
├── src/
│   ├── components/          # Dashboard and transfer components
│   ├── pages/               # Secondary pages
│   └── styles/              # UI styles and themes
├── package.json
└── vite.config.ts
```

## Known limitations

Pulsync is still experimental and has not been hardened for public production use. Peer matching uses observed IP address buckets as a heuristic; it does not prove that devices share the same Wi-Fi network. VPNs, NAT, browser differences, firewalls, and wireless client isolation can prevent direct connections.

The current signaling service has not been fully hardened against abuse. Before exposing it publicly, add and test appropriate rate limits, origin controls, signaling protections, HTTPS, proxy configuration, and cross-browser/network coverage. If a direct local connection cannot be established, the transfer should fail rather than send file contents through a public relay.

## License

All rights reserved. See [LICENSE](LICENSE) for the project terms. Use, copying, modification, and redistribution require permission from the copyright holder.
