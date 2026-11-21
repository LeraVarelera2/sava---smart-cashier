import { Construction } from 'lucide-react'

export default function Dashboard() {
  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">Ringkasan</p><h1>Beranda</h1></div></header>
      <div className="placeholder-card">
        <span className="placeholder-icon"><Construction size={28} /></span>
        <div><h2>Beranda bagian kedua segera hadir</h2><p>Ringkasan penjualan dan fitur analitik akan tersedia di Stage berikutnya. Gunakan Kasir untuk mulai mencatat transaksi.</p></div>
      </div>
    </section>
  )
}
