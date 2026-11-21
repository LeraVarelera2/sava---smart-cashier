import { useEffect, useState } from 'react'
import { Save, Store, MapPin, Phone, BriefcaseBusiness, LogOut } from 'lucide-react'
import { api, notifyApiError } from '../api'
import { useToast } from '../components/ToastProvider'

const emptyProfile = { business_name: '', business_type: '', address: '', rt: '', rw: '', kelurahan: '', phone: '', kesibukan: null }
const profileFields = ['business_name', 'business_type', 'address', 'rt', 'rw', 'kelurahan', 'phone']

function normalizeProfile(profile = {}) {
  profile = profile || {}
  const normalized = { ...emptyProfile, ...profile }
  profileFields.forEach(field => { normalized[field] = profile[field] ?? '' })
  normalized.kesibukan = profile.kesibukan ?? null
  return normalized
}

export default function Profile({ onLogout }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api.getProfile().then(data => setForm(normalizeProfile(data.data))).catch(err => notifyApiError(err, showToast)).finally(() => setLoading(false))
  }, [])

  function change(key, value) { setForm(current => ({ ...current, [key]: value })) }

  async function save(e) {
    e.preventDefault()
    setPending(true)
    try {
      const payload = Object.fromEntries(profileFields.map(field => [field, form[field]]))
      const data = await api.updateProfile(payload)
      setForm(current => normalizeProfile({ ...current, ...(data.data || {}), kesibukan: current.kesibukan }))
      showToast('success', data.message || 'Profil berhasil disimpan.')
    } catch (err) {
      notifyApiError(err, showToast)
    } finally { setPending(false) }
  }

  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">Identitas usaha</p><h1>Profil bisnis</h1></div><button type="button" className="secondary-button mobile-logout" onClick={onLogout}><LogOut size={16} /> Keluar</button></header>
      {loading ? <div className="profile-loading"><div className="skeleton" /><div className="skeleton" /></div> :
        <form className="profile-layout" onSubmit={save}>
          <aside className="profile-summary">
            <span className="profile-icon"><Store size={26} /></span>
            <h2>{form.business_name || 'Nama usaha'}</h2>
            <p>{form.business_type || 'Jenis usaha belum diisi'}</p>
            <div className="profile-busy-summary">
              <span><BriefcaseBusiness size={15} /> Kesibukan usaha</span>
              <div><small>Hari tersibuk</small><strong>{form.kesibukan?.hari_tersibuk || 'Belum ada hari dominan'}</strong></div>
              <div><small>Jam sibuk</small><strong>{form.kesibukan?.jam_tersibuk?.map(item => item.jam).join(', ') || 'Data jam belum tersedia'}</strong></div>
            </div>
          </aside>
          <div className="profile-form">
            <div className="form-section-title"><Store size={18} /><h2>Informasi utama</h2></div>
            <div className="profile-grid">
              <label>Nama usaha<input value={form.business_name} onChange={e => change('business_name', e.target.value)} required /></label>
              <label>Jenis usaha<input value={form.business_type} onChange={e => change('business_type', e.target.value)} /></label>
              <label className="full">Alamat<textarea value={form.address} onChange={e => change('address', e.target.value)} rows="3" /></label>
            </div>
            <div className="form-section-title"><MapPin size={18} /><h2>Lokasi</h2></div>
            <div className="profile-grid">
              <label>RT<input value={form.rt} onChange={e => change('rt', e.target.value)} /></label>
              <label>RW<input value={form.rw} onChange={e => change('rw', e.target.value)} /></label>
              <label className="full">Kelurahan<input value={form.kelurahan} onChange={e => change('kelurahan', e.target.value)} /></label>
            </div>
            <div className="form-section-title"><Phone size={18} /><h2>Kontak & aktivitas</h2></div>
            <div className="profile-grid">
              <label>Nomor telepon<input value={form.phone} onChange={e => change('phone', e.target.value)} /></label>
            </div>
            <div className="profile-actions"><button className="primary-button" disabled={pending}><Save size={18} />{pending ? 'Menyimpan...' : 'Simpan perubahan'}</button></div>
          </div>
        </form>}
    </section>
  )
}
