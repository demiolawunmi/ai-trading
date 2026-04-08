import { useCallback, useEffect, useState } from 'react'

type HealthPayload = { status?: string; app?: string }

export const useWorkerAvailability = () => {
  const [ok, setOk] = useState<boolean | null>(null)
  const [detail, setDetail] = useState<string>('')

  const ping = useCallback(async () => {
    try {
      const response = await fetch('/health')
      if (!response.ok) {
        setOk(false)
        setDetail(`HTTP ${String(response.status)}`)
        return
      }
      const payload = (await response.json()) as HealthPayload
      setOk(payload.status === 'ok')
      setDetail(payload.app ? `Worker: ${payload.app}` : 'Worker reachable')
    } catch {
      setOk(false)
      setDetail('Worker unreachable (is it running on :4000?)')
    }
  }, [])

  useEffect(() => {
    void ping()
    const id = window.setInterval(() => {
      void ping()
    }, 15000)
    return () => window.clearInterval(id)
  }, [ping])

  return { ok, detail, refresh: ping }
}
