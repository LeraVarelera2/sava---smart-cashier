import { useEffect, useRef, useState } from 'react'

export default function ConfirmDialog({
  title,
  description,
  actionLabel = 'Lanjutkan',
  onCancel,
  onConfirm,
  onError,
}) {
  const [pending, setPending] = useState(false)
  const cancelButton = useRef(null)

  useEffect(() => {
    cancelButton.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, pending])

  async function confirm() {
    setPending(true)
    try {
      await onConfirm()
      onCancel()
    } catch (error) {
      onError(error)
      setPending(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !pending && onCancel()}>
      <section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <div className="modal-header">
          <div><p className="eyebrow">Konfirmasi</p><h2 id="confirm-title">{title}</h2></div>
        </div>
        <p className="confirm-description" id="confirm-description">{description}</p>
        <div className="modal-actions">
          <button type="button" ref={cancelButton} className="secondary-button" onClick={onCancel} disabled={pending}>Batal</button>
          <button type="button" className="primary-button danger-action" onClick={confirm} disabled={pending}>
            {pending ? 'Memproses...' : actionLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
