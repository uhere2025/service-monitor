# service-monitor

A minimal dark-mode dashboard for monitoring systemd services and Docker containers on a Linux host. Polls status every 5 seconds and lets you inspect the last 20 log lines per service.

## Stack

- **Frontend** — React 19 + MUI + Vite (TypeScript)
- **Backend** — Express 5 server that invokes `systemctl` / `docker` (via `execFile`, no shell)
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
npm install
npm run build
./install.sh
```

`install.sh` renders `service-monitor.service.template` into `service-monitor.service` — filling the `__USER__`, `__WORKDIR__`, and `__NODE_BIN_DIR__` placeholders from `whoami`, the project directory, and the resolved `node` path — then copies it to `/etc/systemd/system/`, enables it, and starts it. The unit runs `tsx server/index.ts` directly as the installing user, so `npm install` must have populated `node_modules/` first.

Check status:

```bash
systemctl status service-monitor
journalctl -u service-monitor -f
```

## Configuration

Services are hardcoded in `server/index.ts`:

```ts
const SERVICES: { name: string; type: ServiceType }[] = [
  { name: 'lms-server',                     type: 'systemctl' },
  { name: 'opencrawl',                      type: 'systemctl' },
  { name: 'openclaw-docker-chromium-vnc-1', type: 'docker' },
  { name: 'happy-safe-recorder',            type: 'systemctl' },
  { name: 'forgejo',                        type: 'docker' },
  { name: 'forgejo-db',                     type: 'docker' },
]
```

Add or remove entries and restart the server to pick up changes. `type` is either `"systemctl"` or `"docker"`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/services` | Status of all configured services |
| GET | `/api/services/:name/logs` | Last 20 log lines for a service |
