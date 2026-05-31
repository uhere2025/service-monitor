import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  createTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'

type ServiceType = 'systemctl' | 'docker'

type ServiceStatus = {
  name: string
  type: ServiceType
  status: string
  checkedAt: string
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0d0d0d', paper: '#111' },
    text: { primary: '#e0e0e0', secondary: '#555' },
  },
  typography: { fontFamily: '"JetBrains Mono", "Fira Code", "Roboto Mono", monospace' },
})

type StatusMeta = { bg: string; label: string; border: string }

function statusMeta(status: string): StatusMeta {
  if (status === 'active' || status === 'running')
    return { bg: '#0d2218', label: '#22c55e', border: '#22c55e44' }
  if (status === 'failed' || status === 'exited' || status === 'not found')
    return { bg: '#1f0d0d', label: '#ef4444', border: '#ef444444' }
  if (status === 'activating' || status === 'paused' || status === 'restarting')
    return { bg: '#1f1608', label: '#f59e0b', border: '#f59e0b44' }
  return { bg: '#111', label: '#888', border: '#ffffff11' }
}

const POLL_INTERVAL = 5000

type LogState = { svc: ServiceStatus; lines: string[] | null; loading: boolean; error: string | null }

export default function App() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logState, setLogState] = useState<LogState | null>(null)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<ServiceType>('systemctl')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const openLogs = async (svc: ServiceStatus) => {
    setLogState({ svc, lines: null, loading: true, error: null })
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(svc.name)}/logs`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogState((prev) => prev && { ...prev, lines: data.lines, loading: false })
    } catch (e: any) {
      setLogState((prev) => prev && { ...prev, loading: false, error: e.message })
    }
  }

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ServiceStatus[] = await res.json()
      setServices(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const addService = async () => {
    const name = newName.trim()
    if (!name) return
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: newType }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setNewName('')
      await fetchServices()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteService = async (name: string) => {
    if (!confirm(`Stop monitoring "${name}"?`)) return
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      await fetchServices()
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => {
    fetchServices()
    const interval = setInterval(fetchServices, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 960, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4, borderBottom: '1px solid #222', pb: 2 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, letterSpacing: -0.5, color: '#e0e0e0', mt: 0.5 }}
          >
            service monitor
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#444', mt: 0.5, textAlign: 'center' }}>
            {lastUpdate
              ? `synced ${lastUpdate.toLocaleTimeString()} · ${POLL_INTERVAL / 1000}s interval· ${services.length} services`
              : 'connecting...'}
          </Typography>
        </Box>

        {/* Add service */}
        <Box sx={{ mb: 3 }}>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              addService()
            }}
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <InputBase
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="service name"
              spellCheck={false}
              sx={{
                flex: '1 1 200px',
                px: 1.5,
                py: 0.75,
                fontSize: 13,
                color: '#ddd',
                border: '1px solid #222',
                borderRadius: 1,
                background: '#0d0d0d',
                '&:focus-within': { borderColor: '#444' },
              }}
            />
            <ToggleButtonGroup
              value={newType}
              exclusive
              size="small"
              onChange={(_e, v) => v && setNewType(v)}
              sx={{
                '& .MuiToggleButton-root': {
                  color: '#666',
                  borderColor: '#222',
                  fontSize: 11,
                  textTransform: 'lowercase',
                  px: 1.5,
                  py: 0.5,
                },
                '& .Mui-selected': { color: '#ddd !important' },
              }}
            >
              <ToggleButton value="systemctl">systemctl</ToggleButton>
              <ToggleButton value="docker">docker</ToggleButton>
            </ToggleButtonGroup>
            <Button
              type="submit"
              disabled={submitting || !newName.trim()}
              sx={{
                color: '#22c55e',
                borderColor: '#22c55e44',
                fontSize: 12,
                textTransform: 'lowercase',
                minWidth: 64,
              }}
              variant="outlined"
              size="small"
            >
              {submitting ? '...' : 'add'}
            </Button>
          </Box>
          {formError && (
            <Typography sx={{ fontSize: 11, color: '#ef4444', mt: 1 }}>✕ {formError}</Typography>
          )}
        </Box>

        {error && (
          <Box
            sx={{
              mb: 3,
              px: 2,
              py: 1,
              border: '1px solid #ef444444',
              borderRadius: 1,
              background: '#ef444411',
            }}
          >
            <Typography sx={{ fontSize: 12, color: '#ef4444' }}>✕ {error}</Typography>
          </Box>
        )}

        {loading && !services.length ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={16} thickness={5} />
            <Typography sx={{ fontSize: 12, color: '#444' }}>loading...</Typography>
          </Box>
        ) : error ? null : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 1.5,
            }}
          >
            {services.map((svc) => {
              const meta = statusMeta(svc.status)
              return (
                <Box
                  key={svc.name}
                  onClick={() => openLogs(svc)}
                  sx={{
                    border: `1px solid ${meta.border}`,
                    borderRadius: 1,
                    background: meta.bg,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    cursor: 'pointer',
                    transition: 'background 0.3s, border-color 0.3s',
                    '&:hover': { borderColor: meta.label + 'aa' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: '#444',
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                      }}
                    >
                      {svc.type}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteService(svc.name)
                      }}
                      sx={{
                        color: '#333',
                        p: 0.25,
                        '&:hover': { color: '#ef4444' },
                      }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#ddd', lineHeight: 1.2 }}>
                    {svc.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: meta.label, fontWeight: 500 }}>
                    {svc.status}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      <Dialog
        open={!!logState}
        onClose={() => setLogState(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { background: '#111', border: '1px solid #222' } } }}
      >
        {logState && (
          <>
            <DialogTitle
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}
            >
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#ddd' }}>
                  {logState.svc.name}
                </Typography>
                <Typography sx={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {logState.svc.type} · last 20 lines
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => openLogs(logState.svc)}
                  disabled={logState.loading}
                  sx={{ color: '#555' }}
                >
                  <RefreshIcon
                    fontSize="small"
                    sx={{
                      animation: logState.loading ? 'spin 0.8s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                </IconButton>
                <IconButton size="small" onClick={() => setLogState(null)} sx={{ color: '#555' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              {logState.loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                  <CircularProgress size={14} thickness={5} />
                  <Typography sx={{ fontSize: 12, color: '#444' }}>loading logs...</Typography>
                </Box>
              ) : logState.error ? (
                <Typography sx={{ fontSize: 12, color: '#ef4444', py: 1 }}>✕ {logState.error}</Typography>
              ) : !logState.lines?.length ? (
                <Typography sx={{ fontSize: 12, color: '#444', py: 1 }}>no logs available</Typography>
              ) : (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    background: '#0d0d0d',
                    borderRadius: 1,
                    fontSize: 11,
                    color: '#aaa',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: 1.7,
                    maxHeight: 480,
                    overflowY: 'auto',
                  }}
                >
                  {logState.lines.join('\n')}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </ThemeProvider>
  )
}
