import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, PackageOpen, X, Check } from 'lucide-react'
import { api } from '../api'

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const blankVariant = () => ({ variant_name: '', pack_size: '', size_label: '', price: '' })

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editor, setEditor] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try { const data = await api.products(); setProducts(data.data || []) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function removeProduct(product) {
    if (!window.confirm(`Hapus produk "${product.name}"?`)) return
    try { const data = await api.deleteProduct(product.id); setMessage(data.message || 'Produk dihapus'); await load() }
    catch (err) { setError(err.message) }
  }
  async function removeVariant(variant) {
    if (!window.confirm(`Hapus varian "${variant.variant_name}"?`)) return
    try { const data = await api.deleteVariant(variant.id); setMessage(data.message || 'Varian dihapus'); await load() }
    catch (err) { setError(err.message) }
  }

  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">Inventaris</p><h1>Katalog</h1></div><button className="primary-button" onClick={() => setEditor({ mode: 'create', name: '', variants: [blankVariant()] })}><Plus size={18} /> Tambah produk</button></header>
      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status"><Check size={18} />{message}</div>}
      {loading ? <div className="loading-list"><div className="skeleton" /><div className="skeleton" /></div> :
        products.length ? <div className="catalog-list">
          {products.map(product => (
            <article className="catalog-card" key={product.id}>
              <div className="catalog-card-header">
                <div className="catalog-name"><span><PackageOpen size={19} /></span><div><h2>{product.name}</h2><p>{product.variants?.length || 0} varian</p></div></div>
                <div className="card-actions"><button className="icon-button" title="Edit produk" onClick={() => setEditor({ mode: 'edit', id: product.id, name: product.name, variants: product.variants || [] })}><Pencil size={17} /></button><button className="icon-button danger" title="Hapus produk" onClick={() => removeProduct(product)}><Trash2 size={17} /></button></div>
              </div>
              <div className="variant-list">
                {product.variants?.map(variant => (
                  <div className="variant-row" key={variant.id}>
                    <span className={`status-dot ${variant.is_active === false ? 'inactive' : ''}`} />
                    <div><strong>{variant.variant_name}</strong><small>{variant.size_label || (variant.pack_size ? `${variant.pack_size} kemasan` : 'Ukuran standar')}</small></div>
                    <strong>{rupiah(variant.price)}</strong>
                    <button className="icon-button" title="Edit varian" onClick={() => setEditor({ mode: 'variant', productId: product.id, id: variant.id, name: product.name, variants: [variant] })}><Pencil size={16} /></button>
                    <button className="icon-button danger" title="Hapus varian" onClick={() => removeVariant(variant)}><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" className="text-button" onClick={() => setEditor({ mode: 'createVariant', productId: product.id, id: null, name: product.name, variants: [blankVariant()] })}><Plus size={16} /> Tambah varian</button>
              </div>
            </article>
          ))}
        </div> : <div className="empty-state"><PackageOpen size={30} /><h3>Belum ada produk</h3><p>Tambahkan produk pertama untuk mulai berjualan.</p></div>}
      {editor && <ProductEditor editor={editor} onClose={() => setEditor(null)} onSaved={async msg => { setEditor(null); setMessage(msg); await load() }} onError={setError} />}
    </section>
  )
}

function ProductEditor({ editor, onClose, onSaved, onError }) {
  const [name, setName] = useState(editor.name)
  const [variants, setVariants] = useState(editor.variants.map(v => ({ ...v, price: v.price ?? '' })))
  const [pending, setPending] = useState(false)
  async function save(e) {
    e.preventDefault()
    setPending(true); onError('')
    try {
      if (editor.mode === 'createVariant') {
        const v = variants[0]
        const data = await api.createVariant(editor.productId, { variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price) })
        await onSaved(data.message || 'Varian ditambahkan')
      } else if (editor.mode === 'variant') {
        const v = variants[0]
        const data = await api.updateVariant(editor.id, { variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price), is_active: v.is_active !== false })
        await onSaved(data.message || 'Varian diperbarui')
      } else if (editor.mode === 'create') {
        const data = await api.createProduct({ name, variants: variants.map(v => ({ variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price) })) })
        await onSaved(data.message || 'Produk dibuat')
      } else {
        const data = await api.updateProduct(editor.id, { name })
        await onSaved(data.message || 'Produk diperbarui')
      }
    } catch (err) { onError(err.data?.errors ? Object.values(err.data.errors).flat().join(' ') : err.message) }
    finally { setPending(false) }
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={save}>
        <div className="modal-header"><div><p className="eyebrow">{editor.mode === 'create' ? 'Produk baru' : 'Perbarui'}</p><h2>{editor.mode === 'create' ? 'Tambah produk' : editor.mode === 'createVariant' ? 'Tambah varian' : editor.mode === 'variant' ? 'Edit varian' : 'Edit produk'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>
        {editor.mode !== 'variant' && editor.mode !== 'createVariant' && <label>Nama produk<input value={name} onChange={e => setName(e.target.value)} required /></label>}
        {editor.mode !== 'edit' && variants.map((v, i) => (
          <div className="variant-form" key={i}>
            <div className="variant-form-grid">
              <label>Nama varian<input value={v.variant_name} onChange={e => setVariants(cur => cur.map((x,n) => n === i ? { ...x, variant_name: e.target.value } : x))} required /></label>
              <label>Label ukuran<input value={v.size_label || ''} onChange={e => setVariants(cur => cur.map((x,n) => n === i ? { ...x, size_label: e.target.value } : x))} placeholder="Contoh: 1 pcs" /></label>
              <label>Ukuran kemasan (opsional)<input value={v.pack_size || ''} onChange={e => setVariants(cur => cur.map((x,n) => n === i ? { ...x, pack_size: e.target.value } : x))} /></label>
              <label>Harga<input type="number" min="1" value={v.price} onChange={e => setVariants(cur => cur.map((x,n) => n === i ? { ...x, price: e.target.value } : x))} required /></label>
            </div>
            {editor.mode === 'create' && variants.length > 1 && <button type="button" className="text-button danger" onClick={() => setVariants(cur => cur.filter((_,n) => n !== i))}>Hapus varian</button>}
          </div>
        ))}
        {editor.mode === 'create' && <button type="button" className="text-button" onClick={() => setVariants(cur => [...cur, blankVariant()])}><Plus size={16} /> Tambah varian</button>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan'}</button></div>
      </form>
    </div>
  )
}
