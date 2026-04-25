# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Express (tsx watch, port 8722) + Vite dev server (port 5173) via concurrently
npm run build    # tsc -b && vite build → dist/
npm start        # production: serve dist/ + API on :8722
npm run lint     # eslint
./install.sh     # copy service unit, enable + start systemd service (requires sudo)
```

No test suite is configured.

## Architecture

This is a two-process app in development, single-process in production:

**Backend** (`server/index.ts`) — Express 5 server on `:8722`. Shells out to `systemctl is-active` and `docker inspect` to get service status, and `journalctl` / `docker logs` for log lines. The monitored service list (`SERVICES`) is hardcoded in this file — edit it to add/remove services.

**Frontend** (`src/App.tsx`) — Single React component. Polls `/api/services` every 5 s via `setInterval`, renders a responsive MUI card grid with color-coded status. Clicking a card fetches `/api/services/:name/logs` and opens a dialog with the last 20 lines.

**Dev proxy** — Vite proxies `/api/*` to `http://localhost:8722` (`vite.config.ts`), so the frontend always calls `/api/...` regardless of environment.

**Production** — `npm run build` writes the frontend bundle to `dist/`. `npm start` runs the Express server which serves `dist/` as static files and handles `/api` routes, all on `:8722`.

**Systemd** — `service-monitor.service` runs `tsx server/index.ts` directly (no build step needed at runtime) as user `mimilo`, with the nvm Node path baked into `Environment=PATH`.
