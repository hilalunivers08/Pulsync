# Deployment plan: Vercel frontend + Go API

This integrated version preserves the original dashboard layout and runs the local-transfer engine in a hidden same-origin frame. It is still experimental. Do not expose the signaling backend to the public until rate limits, signaling abuse protection, allowed origins, HTTPS, and the LAN-only claim have been reviewed and tested.

## Vercel frontend

- Import the GitHub repository in Vercel.
- Root directory: `.` (the directory containing `package.json`).
- Framework preset: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Configure `VITE_API_BASE_URL` to the HTTPS origin of the Go backend, e.g. `https://api.your-domain.example`.

Vite embeds `VITE_API_BASE_URL` at build time. Redeploy after changing it. Do not put credentials or secrets in this variable.

## Go backend

Run the Go backend on a server that is reachable by the browser. Put a TLS reverse proxy in front of it so browsers can call the API over HTTPS. The current server listens on port 8080 and keeps the existing REST endpoints plus the new `/api/p2p/*` signaling endpoints.

If and only if the reverse proxy is trusted and overwrites `X-Forwarded-For`, set `PULSYNC_TRUST_PROXY=1`; otherwise leave it unset. The peer network bucket is a matching heuristic, not strong authentication or proof of LAN membership.

## Local two-device development

Terminal 1:

```powershell
cd backend
go run .
```

Terminal 2:

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

Open the same Vite URL using the server computer's LAN IP on both devices, for example `http://192.168.1.4:5173`. In default local mode, API requests go to `http://192.168.1.4:8080`. Avoid mixing `localhost` and the LAN IP.

## Important limitation

The browser exchanges local host candidates and the server groups peers by observed address. This reduces accidental public-path transfers but does not mathematically prove both devices share the same Wi-Fi segment. Public deployment must not be presented as security-hardened until cross-network, NAT, VPN, proxy, and browser cases have been tested and appropriate protections added.
