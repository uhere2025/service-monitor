import express from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)
const app = express()
app.use(express.json())
const __dirname = path.dirname(fileURLToPath(import.meta.url))

type ServiceType = 'systemctl' | 'docker'
type Service = { name: string; type: ServiceType }

// Live, user-editable list (gitignored). Seeded from DEFAULTS_FILE on first run.
const SERVICES_FILE = path.join(__dirname, '../services.json')
// Committed default list used to seed services.json when it does not exist yet.
const DEFAULTS_FILE = path.join(__dirname, '../services.default.json')

// systemd unit / docker container names; also guards the execFile arguments.
const NAME_RE = /^[A-Za-z0-9._@-]+$/

let services: Service[] = []

async function readServiceList(file: string): Promise<Service[]> {
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${file} must be a JSON array`)
  return parsed.filter(
    (s): s is Service =>
      s && typeof s.name === 'string' && (s.type === 'systemctl' || s.type === 'docker')
  )
}

async function loadServices(): Promise<void> {
  try {
    services = await readServiceList(SERVICES_FILE)
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to read ${SERVICES_FILE}, seeding defaults:`, err.message)
    }
    try {
      services = await readServiceList(DEFAULTS_FILE)
    } catch (defErr: any) {
      console.error(`Failed to read ${DEFAULTS_FILE}:`, defErr.message)
      services = []
    }
    await saveServices()
  }
}

async function saveServices(): Promise<void> {
  await writeFile(SERVICES_FILE, JSON.stringify(services, null, 2) + '\n')
}

async function getSystemctlStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('systemctl', ['is-active', name])
    return stdout.trim()
  } catch (err: any) {
    // systemctl is-active exits non-zero for inactive/failed, stdout still has the state
    return err.stdout?.trim() || 'unknown'
  }
}

async function getDockerStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('docker', ['inspect', '--format={{.State.Status}}', name])
    return stdout.trim()
  } catch {
    return 'not found'
  }
}

async function getSystemctlLogs(name: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('journalctl', ['-u', name, '-n', '20', '--no-pager', '--output=short-iso'])
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function getDockerLogs(name: string): Promise<string[]> {
  try {
    // docker logs writes to stderr even on success
    const { stdout, stderr } = await execFileAsync('docker', ['logs', '--tail', '20', '--timestamps', name])
    const combined = (stderr + stdout).trim()
    return combined.split('\n').filter(Boolean)
  } catch (err: any) {
    const combined = ((err.stderr || '') + (err.stdout || '')).trim()
    return combined.split('\n').filter(Boolean)
  }
}

app.get('/api/services/:name/logs', async (req, res) => {
  const { name } = req.params
  const svc = services.find((s) => s.name === name)
  if (!svc) return res.status(404).json({ error: 'not found' })
  const lines =
    svc.type === 'systemctl' ? await getSystemctlLogs(name) : await getDockerLogs(name)
  res.json({ lines })
})

app.get('/api/services', async (_req, res) => {
  const results = await Promise.all(
    services.map(async (svc) => {
      const status =
        svc.type === 'systemctl'
          ? await getSystemctlStatus(svc.name)
          : await getDockerStatus(svc.name)
      return { name: svc.name, type: svc.type, status, checkedAt: new Date().toISOString() }
    })
  )
  res.json(results)
})

app.post('/api/services', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const type = req.body?.type
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid service name' })
  if (type !== 'systemctl' && type !== 'docker')
    return res.status(400).json({ error: 'type must be "systemctl" or "docker"' })
  if (services.some((s) => s.name === name))
    return res.status(409).json({ error: 'service already exists' })

  const svc: Service = { name, type }
  services.push(svc)
  await saveServices()
  res.status(201).json(svc)
})

app.delete('/api/services/:name', async (req, res) => {
  const { name } = req.params
  const idx = services.findIndex((s) => s.name === name)
  if (idx === -1) return res.status(404).json({ error: 'not found' })
  services.splice(idx, 1)
  await saveServices()
  res.status(204).end()
})

// Serve Vite build in production
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

await loadServices()

const PORT = Number(process.env.PORT) || 8722

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Service monitor listening on http://0.0.0.0:${PORT}`)
})
