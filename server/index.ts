import express from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)
const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

type ServiceType = 'systemctl' | 'docker'

const SERVICES: { name: string; type: ServiceType }[] = [
  { name: 'lms-server', type: 'systemctl' },
  { name: 'opencrawl', type: 'systemctl' },
  { name: 'openclaw-fay', type: 'docker' },
  { name: 'happy-safe-recorder', type: 'systemctl' },
]

async function getSystemctlStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`systemctl is-active ${name}`)
    return stdout.trim()
  } catch (err: any) {
    // systemctl is-active exits non-zero for inactive/failed, stdout still has the state
    return err.stdout?.trim() || 'unknown'
  }
}

async function getDockerStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${name}`)
    return stdout.trim().replace(/'/g, '')
  } catch {
    return 'not found'
  }
}

async function getSystemctlLogs(name: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`journalctl -u ${name} -n 20 --no-pager --output=short-iso`)
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function getDockerLogs(name: string): Promise<string[]> {
  try {
    // docker logs writes to stderr even on success
    const { stdout, stderr } = await execAsync(`docker logs --tail 20 --timestamps ${name}`)
    const combined = (stderr + stdout).trim()
    return combined.split('\n').filter(Boolean)
  } catch (err: any) {
    const combined = ((err.stderr || '') + (err.stdout || '')).trim()
    return combined.split('\n').filter(Boolean)
  }
}

app.get('/api/services/:name/logs', async (req, res) => {
  const { name } = req.params
  const svc = SERVICES.find((s) => s.name === name)
  if (!svc) return res.status(404).json({ error: 'not found' })
  const lines =
    svc.type === 'systemctl' ? await getSystemctlLogs(name) : await getDockerLogs(name)
  res.json({ lines })
})

app.get('/api/services', async (_req, res) => {
  const results = await Promise.all(
    SERVICES.map(async (svc) => {
      const status =
        svc.type === 'systemctl'
          ? await getSystemctlStatus(svc.name)
          : await getDockerStatus(svc.name)
      return { name: svc.name, type: svc.type, status, checkedAt: new Date().toISOString() }
    })
  )
  res.json(results)
})

// Serve Vite build in production
const distPath = path.join(__dirname, '../dist')
app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(8722, '0.0.0.0', () => {
  console.log('Service monitor listening on http://0.0.0.0:8722')
})
