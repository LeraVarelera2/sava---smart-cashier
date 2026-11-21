import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBasket, PackageOpen, Store, LogOut } from 'lucide-react'
import { api, clearSession, getToken, getUser, setSession } from './api'
import Login from './pages/Login'
import Cashier from './pages/Cashier'
import Catalog from './pages/Catalog'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'

function Protected({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [user, setUser] = useState(getUser())
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setNotice('Sesi berakhir. Silakan masuk kembali.')
      navigate('/login', { replace: true })
    }

    window.addEventListener('sava:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('sava:unauthorized', handleUnauthorized)
  }, [navigate])

  function handleLogin(token, loggedUser) {
    setSession(token, loggedUser)
    setUser(loggedUser)
    setNotice('')
    navigate('/kasir')
  }

  async function handleLogout() {
    let logoutError = null
    try {
      await api.logout()
    } catch (error) {
      logoutError = error
    }
    clearSession()
    setUser(null)
    setNotice(logoutError ? `Sesi lokal ditutup, tetapi logout server gagal: ${logoutError.message}` : '')
    navigate('/login', { replace: true })
  }

  if (!getToken()) {
    return <Routes><Route path="/login" element={<Login onLogin={handleLogin} notice={notice} />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
  }

  const nav = [
    ['/dashboard', LayoutDashboard, 'Beranda'],
    ['/kasir', ShoppingBasket, 'Kasir'],
    ['/katalog', PackageOpen, 'Katalog'],
    ['/profil', Store, 'Profil'],
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>Sava</span></div>
        <nav className="side-nav">
          {nav.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={20} strokeWidth={2} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">{(user?.name || 'S').charAt(0).toUpperCase()}</div>
          <div className="user-copy"><strong>{user?.name || 'Pengguna'}</strong><span>{user?.email || ''}</span></div>
          <button className="icon-button" onClick={handleLogout} title="Keluar" aria-label="Keluar"><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/kasir" element={<Protected><Cashier /></Protected>} />
          <Route path="/katalog" element={<Protected><Catalog /></Protected>} />
          <Route path="/profil" element={<Protected><Profile onLogout={handleLogout} /></Protected>} />
          <Route path="/login" element={<Navigate to="/kasir" replace />} />
          <Route path="*" element={<Navigate to="/kasir" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {nav.map(([to, Icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
