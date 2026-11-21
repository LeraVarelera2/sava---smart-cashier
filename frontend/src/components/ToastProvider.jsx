import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const toastIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Map())

  const dismissToast = useCallback(id => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((type, message) => {
    if (!message) return
    const id = ++nextId.current
    const duration = type === 'error' ? 8000 : 5000

    setToasts(current => {
      const next = [...current, { id, type, message }].slice(-3)
      current.slice(0, Math.max(0, current.length + 1 - 3)).forEach(toast => {
        window.clearTimeout(timers.current.get(toast.id))
        timers.current.delete(toast.id)
      })
      return next
    })
    timers.current.set(id, window.setTimeout(() => dismissToast(id), duration))
  }, [dismissToast])

  useEffect(() => {
    function handleApiError(event) {
      showToast('error', event.detail?.message || 'Permintaan gagal.')
    }

    window.addEventListener('sava:api-error', handleApiError)
    return () => window.removeEventListener('sava:api-error', handleApiError)
  }, [showToast])

  useEffect(() => () => {
    timers.current.forEach(timer => window.clearTimeout(timer))
    timers.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
        {toasts.map(toast => {
          const Icon = toastIcons[toast.type] || Info
          return (
            <div className={`toast toast-${toast.type}`} key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}>
              <Icon size={20} aria-hidden="true" />
              <span>{toast.message}</span>
              <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Tutup notifikasi">
                <X size={18} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast harus digunakan di dalam ToastProvider.')
  return context
}
