import { useState } from 'react'
import { Store, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { api, notifyApiError } from '../api'
import { useToast } from '../components/ToastProvider'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const { showToast } = useToast()

  async function submit(e) {
    e.preventDefault()
    setPending(true)
    try {
      const data = await api.login(email, password)
      onLogin(data.token, data.user)
    } catch (err) {
      notifyApiError(err, showToast)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand"><span className="brand-mark large">S</span><div><strong>Sava</strong><span>Cashier</span></div></div>
        <div className="login-heading"><p>Selamat datang kembali</p><h1>Masuk ke kasir</h1></div>
        <form onSubmit={submit} className="login-form">
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@toko.com" required autoComplete="email" />
          </label>
          <label>Kata sandi
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan kata sandi" required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <button className="primary-button login-button" disabled={pending}>
            {pending ? 'Memproses...' : 'Masuk'} {!pending && <ArrowRight size={18} />}
          </button>
        </form>
        <p className="login-note"><Store size={16} /> Masuk dengan akun terdaftar.</p>
      </div>
    </div>
  )
}
