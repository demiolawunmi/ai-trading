import { useEffect, useState } from 'react'

const HEALTH_URL = '/health'

type WorkerAvailability = {
  connected: boolean
  checkedAt: string | null
}

const DEFAULT_STATE: WorkerAvailability = {
  connected: false,
  checkedAt: null,
}

export const useWorkerAvailability = () => {
  const [state, setState] = useState<WorkerAvailability>(DEFAULT_STATE)

  useEffect(() => {
    let active = true

    const checkWorker = async () => {
      try {
        const response = await fetch(HEALTH_URL)
        if (!response.ok) {
          throw new Error('health-check-failed')
        }

        const payload = (await response.json()) as { status?: string }
        if (!active) return
        setState({
          connected: payload.status === 'ok',
          checkedAt: new Date().toISOString(),
        })
      } catch (_error) {
        if (!active) return
        setState({
          connected: false,
          checkedAt: new Date().toISOString(),
        })
      }
    }

    void checkWorker()
    const intervalId = window.setInterval(() => {
      void checkWorker()
    }, 10000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  return state
}
