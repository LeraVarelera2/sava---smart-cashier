import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2, ShoppingCart, ReceiptText, X } from 'lucide-react'
import { api, notifyApiError } from '../api'
import { useToast } from '../components/ToastProvider'

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const sizeLabel = variant => variant.size_label || (variant.pack_size ? `${variant.pack_size} pcs` : 'Ukuran standar')

export default function Cashier() {
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  async function load() {
    setLoading(true)
    try { const data = await api.products(); setProducts(data.data || []) }
    catch (err) { notifyApiError(err, showToast) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const variants = useMemo(() => products.flatMap(product =>
    (product.variants || []).filter(v => v.is_active !== false).map(v => ({ ...v, productName: product.name }))
  ).filter(v => `${v.productName} ${v.variant_name} ${v.size_label || ''} ${v.pack_size || ''}`.toLowerCase().includes(search.toLowerCase())),
  [products, search])
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0)

  function add(item) {
    setCart(current => {
      const found = current.find(x => x.variant_id === item.id)
      return found ? current.map(x => x.variant_id === item.id ? { ...x, qty: Math.min(x.qty + 1, 999) } : x)
        : [...current, { variant_id: item.id, variant_name: item.variant_name, productName: item.productName, size_label: item.size_label, pack_size: item.pack_size, price: Number(item.price), qty: 1 }]
    })
  }
  function changeQty(id, delta) {
    setCart(current => current.map(x => x.variant_id === id ? { ...x, qty: Math.min(999, Math.max(1, x.qty + delta)) } : x))
  }

  async function checkout() {
    if (!cart.length) return
    setPending(true)
    try {
      const data = await api.createTransaction(cart.map(({ variant_id, qty }) => ({ variant_id, qty })))
      showToast('success', `Transaksi ${data.data?.code || ''} berhasil disimpan · ${rupiah(data.data?.total_amount || 0)}`)
      setCart([])
    } catch (err) {
      notifyApiError(err, showToast)
    } finally { setPending(false) }
  }

  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">Penjualan</p><h1>Kasir</h1></div><span className="live-label"><i /> Siap melayani</span></header>
      <div className="cashier-grid">
        <div className="catalog-pane">
          <div className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk atau varian..." /></div>
          {loading ? <div className="loading-list">{[1,2,3,4].map(i => <div className="skeleton" key={i} />)}</div> :
            variants.length ? <div className="product-list">
              {variants.map(v => (
                <button className="product-row" key={v.id} onClick={() => add(v)}>
                  <span className="product-icon"><ShoppingCart size={19} /></span>
                  <span className="product-copy"><strong>{v.productName}</strong><small>{v.variant_name} · {sizeLabel(v)}</small></span>
                  <span className="product-price">{rupiah(v.price)}<Plus size={17} /></span>
                </button>
              ))}
            </div> : <div className="empty-state"><PackageIcon /><h3>Tidak ada produk</h3><p>Sesuaikan pencarian atau tambahkan produk di Katalog.</p></div>}
        </div>
        <aside className={`cart-pane ${mobileCartOpen ? 'mobile-cart-open' : ''}`}>
          <div className="cart-heading"><div><ReceiptText size={20} /><h2>Keranjang</h2></div><span>{cart.length} item</span><button type="button" className="cart-close" aria-label="Tutup keranjang" onClick={() => setMobileCartOpen(false)}><X size={19} /></button></div>
          <div className="cart-items">
            {!cart.length ? <div className="cart-empty"><ShoppingCart size={28} /><p>Keranjang masih kosong</p></div> :
              cart.map(item => (
                <div className="cart-row" key={item.variant_id}>
                  <div className="cart-name"><strong>{item.productName}</strong><small>{item.variant_name} · {sizeLabel(item)}</small></div>
                  <div className="qty-control"><button onClick={() => changeQty(item.variant_id, -1)} aria-label="Kurangi"><Minus size={14} /></button><span>{item.qty}</span><button onClick={() => changeQty(item.variant_id, 1)} aria-label="Tambah"><Plus size={14} /></button></div>
                  <strong className="line-total">{rupiah(item.price * item.qty)}</strong>
                  <button className="remove-button" onClick={() => setCart(current => current.filter(x => x.variant_id !== item.variant_id))} aria-label="Hapus item"><Trash2 size={16} /></button>
                </div>
              ))}
          </div>
          <div className="receipt-block">
            <div><span>Total</span><strong>{rupiah(total)}</strong></div>
            <button className="primary-button checkout" disabled={!cart.length || pending} onClick={checkout}>{pending ? 'Menyimpan...' : 'Simpan transaksi'}</button>
          </div>
        </aside>
      </div>
      {mobileCartOpen && <button type="button" className="mobile-cart-backdrop" aria-label="Tutup keranjang" onClick={() => setMobileCartOpen(false)} />}
      <button type="button" className="mobile-cart-toggle" aria-expanded={mobileCartOpen} onClick={() => setMobileCartOpen(open => !open)}>
        <ShoppingCart size={18} /><span>Keranjang · {cart.length}</span><strong>{rupiah(total)}</strong>
      </button>
    </section>
  )
}

function PackageIcon() { return <ShoppingCart size={30} /> }
