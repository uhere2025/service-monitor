# service-monitor

A minimal dark-mode dashboard for monitoring systemd services and Docker containers on a Linux host. Polls status every 5 seconds and lets you inspect the last 20 log lines per service.

## Stack

- **Frontend** — React 19 + MUI + Vite (TypeScript)
- **Backend** — Express 5 server that shells out to `systemctl` / `docker`
- **Runtime** — Node 24 via `tsx`

## Development

```bash
npm install
npm run dev       # starts Express (tsx watch) + Vite dev server concurrently
```

Frontend: `http://localhost:5173`  
API: `http://localhost:5173/api/services` (proxied to Express on `:8722`)

## Production build

```bash
npm run build     # tsc + vite build → dist/
npm start         # serves dist/ + API on :8722
```

## Install as a systemd service

```bash
npm run build
./install.sh
```

`install.sh` copies `service-monitor.service` to `/etc/systemd/system/`, enables it, and starts it. The unit runs as the `mimilo` user from the project directory.

Check status:

```bash
systemctl status service-monitor
journalctl -u service-monitor -f
```

## Configuration

Services are hardcoded in `server/index.ts`:

```ts
const SERVICES: { name: string; type: ServiceType }[] = [
  { name: 'lms-server',          type: 'systemctl' },
  { name: 'opencrawl',           type: 'systemctl' },
  { name: 'openclaw-fay',        type: 'docker' },
  { name: 'happy-safe-recorder', type: 'systemctl' },
]
```

Add or remove entries and restart the server to pick up changes. `type` is either `"systemctl"` or `"docker"`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/services` | Status of all configured services |
| GET | `/api/services/:name/logs` | Last 20 log lines for a service |
