import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, PackageOpen, X } from 'lucide-react'
import { api, notifyApiError } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/ToastProvider'

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const blankVariant = () => ({ variant_name: '', pack_size: '', size_label: '', price: '' })

export default function Catalog() {
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  async function load() {
    setLoading(true)
    try { const data = await api.products(); setProducts(data.data || []) }
    catch (err) { notifyApiError(err, showToast) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function removeProduct(product) {
    setConfirmation({
      title: `Hapus atau nonaktifkan ${product.name}?`,
      description: 'Jika produk memiliki riwayat transaksi, produk dan variannya akan dipertahankan tetapi dinonaktifkan. Jika belum pernah terjual, produk akan dihapus.',
      request: () => api.deleteProduct(product.id),
    })
  }
  async function removeVariant(variant) {
    setConfirmation({
      title: `Hapus atau nonaktifkan ${variant.variant_name}?`,
      description: 'Jika varian memiliki riwayat transaksi, data akan dipertahankan dan varian dinonaktifkan. Jika belum pernah terjual, varian akan dihapus.',
      request: () => api.deleteVariant(variant.id),
    })
  }
  async function confirmAction() {
    const data = await confirmation.request()
    showToast('success', data.message || 'Perubahan katalog berhasil disimpan.')
    await load()
  }

  return (
    <section>
      <header className="page-header"><div><p className="eyebrow">Inventaris</p><h1>Katalog</h1></div><button className="primary-button" onClick={() => setEditor({ mode: 'create', name: '', variants: [blankVariant()] })}><Plus size={18} /> Tambah produk</button></header>
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
      {editor && <ProductEditor editor={editor} onClose={() => setEditor(null)} onSaved={async message => { setEditor(null); showToast('success', message); await load() }} />}
      {confirmation && <ConfirmDialog
        title={confirmation.title}
        description={confirmation.description}
        actionLabel="Lanjutkan"
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmAction}
        onError={error => notifyApiError(error, showToast)}
      />}
    </section>
  )
}

function ProductEditor({ editor, onClose, onSaved }) {
  const { showToast } = useToast()
  const [name, setName] = useState(editor.name)
  const [variants, setVariants] = useState(editor.variants.map(v => ({ ...v, price: v.price ?? '' })))
  const [pending, setPending] = useState(false)
  async function save(e) {
    e.preventDefault()
    setPending(true)
    try {
      if (editor.mode === 'createVariant') {
        const v = variants[0]
        const data = await api.createVariant(editor.productId, { variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price) })
        await onSaved(data.message || 'Varian berhasil ditambahkan.')
      } else if (editor.mode === 'variant') {
        const v = variants[0]
        const data = await api.updateVariant(editor.id, { variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price), is_active: v.is_active !== false })
        await onSaved(v.is_active === false ? 'Varian dinonaktifkan.' : 'Varian berhasil diperbarui.')
      } else if (editor.mode === 'create') {
        const data = await api.createProduct({ name, variants: variants.map(v => ({ variant_name: v.variant_name, pack_size: v.pack_size || null, size_label: v.size_label || null, price: Number(v.price) })) })
        await onSaved(data.message || 'Produk berhasil ditambahkan.')
      } else {
        const data = await api.updateProduct(editor.id, { name })
        await onSaved(data.message || 'Produk berhasil diperbarui.')
      }
    } catch (err) { notifyApiError(err, showToast) }
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
            {editor.mode === 'variant' && <label className="toggle-field"><input type="checkbox" checked={v.is_active !== false} onChange={e => setVariants(cur => cur.map((x,n) => n === i ? { ...x, is_active: e.target.checked } : x))} /> Varian aktif dan tampil di kasir</label>}
            {editor.mode === 'create' && variants.length > 1 && <button type="button" className="text-button danger" onClick={() => setVariants(cur => cur.filter((_,n) => n !== i))}>Hapus varian</button>}
          </div>
        ))}
        {editor.mode === 'create' && <button type="button" className="text-button" onClick={() => setVariants(cur => [...cur, blankVariant()])}><Plus size={16} /> Tambah varian</button>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan'}</button></div>
      </form>
    </div>
  )
}
