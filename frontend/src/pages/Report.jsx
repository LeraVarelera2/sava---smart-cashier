import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LoaderCircle,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { api, notifyApiError } from '../api'
import { useToast } from '../components/ToastProvider'

const sourceLabels = { historis: 'Historis', simulasi: 'Simulasi', kasir: 'Kasir', semua: 'Semua sumber' }
const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const integer = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0)

function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID', options)
}

function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { from: '', to: '' }
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function rangeError(from, to) {
  if (!from || !to) return 'Pilih tanggal mulai dan tanggal akhir.'
  if (to < from) return 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.'
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if ((end - start) / 86400000 + 1 > 366) return 'Rentang tanggal maksimal 366 hari.'
  return ''
}

function makeFilterKey(source, from, to) {
  return `${source}|${from}|${to}`
}

function periodLabel(periodType, month, from, to) {
  if (periodType === 'month' && month) {
    const date = new Date(`${month}-01T00:00:00`)
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  if (from === to) return formatDate(from)
  return `${formatDate(from)} – ${formatDate(to)}`
}

function sourceLabel(source) {
  return sourceLabels[source] || 'Semua sumber'
}

function LoadingState({ message = 'Sebentar ya, sedang memuat data…' }) {
  return (
    <div className="dashboard-loading report-loading" role="status" aria-live="polite">
      <div className="dashboard-loading-skeletons" aria-hidden="true">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <div className="dashboard-loading-status"><LoaderCircle className="loading-spinner" size={20} /><span>{message}</span></div>
    </div>
  )
}

function ErrorState({ title, message, onRetry }) {
  return (
    <div className="dashboard-error" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
      <button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} /> Coba lagi</button>
    </div>
  )
}

function ReadingGuide() {
  const points = [
    'Pilih Per bulan atau Rentang tanggal; tanggal yang sama berarti satu hari.',
    'Historis = catatan penjualan asli. Simulasi = data contoh buatan, bukan penjualan nyata.',
    'Kolom cari ikut memfilter rincian, cetak, dan unduhan. Untuk PDF, pilih "Save as PDF" di jendela cetak.',
  ]

  return (
    <>
      <aside className="dashboard-help">
        <div className="dashboard-help-row"><Info size={17} /><p><strong>Rekap dan rincian penjualan yang bisa dicetak atau diunduh.</strong></p></div>
      </aside>
      <aside className="dashboard-reading-guide report-reading-guide" aria-label="Cara membaca">
        <header className="dashboard-reading-title"><BookOpen size={17} /><h2>Cara membaca</h2></header>
        <div className="dashboard-reading-groups">
          <div className="dashboard-reading-group">
            <ul>{points.map(point => <li key={point}><CheckCircle2 size={16} /><span>{point}</span></li>)}</ul>
          </div>
        </div>
      </aside>
    </>
  )
}

function MetricCard({ label, value, note }) {
  return <article className="metric-card"><div className="metric-card-label"><span>{label}</span></div><strong>{value}</strong><small>{note}</small></article>
}

function Conclusion({ report, source, label }) {
  const summary = report?.summary
  const bestDay = report?.daily?.reduce((best, row) => Number(row.omzet) > Number(best?.omzet || -1) ? row : best, null)
  const topProduct = report?.top_products?.[0]
  const text = Number(summary?.jumlah_transaksi) > 0
    ? `Pada ${label} (data ${sourceLabel(source)}), omzet ${rupiah(summary.total_omzet)} dari ${integer(summary.jumlah_transaksi)} transaksi. Hari terbaik: ${formatDate(bestDay?.tanggal)} (${rupiah(bestDay?.omzet)}). Produk teratas: ${topProduct?.variant_name || '—'} (${integer(topProduct?.total_pcs)} pcs).${source === 'simulasi' || source === 'semua' ? ' Data ini termasuk simulasi, bukan penjualan nyata.' : ''}`
    : 'Belum ada penjualan pada periode ini.'

  return <aside className="dashboard-conclusion"><Sparkles size={17} /><div><h2>Kesimpulan</h2><p>{text}</p></div></aside>
}

function Panel({ title, description, children, className = '' }) {
  return (
    <article className={`dashboard-panel ${className}`}>
      <header><h2>{title}</h2>{description && <p>{description}</p>}</header>
      {children}
    </article>
  )
}

function DailyChart({ daily = [] }) {
  const [activeIndex, setActiveIndex] = useState(null)
  if (!daily.length) return <div className="dashboard-empty"><Activity size={22} /><strong>Belum ada data untuk digambarkan.</strong></div>
  const maximum = Math.max(1, ...daily.map(row => Number(row.omzet) || 0))
  const axisValues = [maximum, Math.round(maximum / 2), 0]
  const ticks = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])]

  return (
    <div className="report-chart-shell">
      <div className="report-chart-y-axis" aria-hidden="true">
        {axisValues.map((value, index) => <span key={index}>{integer(value)}</span>)}
      </div>
      <div className="report-chart-main">
        <div className="report-chart-gridlines" aria-hidden="true"><i /><i /><i /></div>
        <div className="report-chart-bars" role="group" aria-label="Omzet per hari">
          {daily.map((row, index) => {
            const percent = Math.max(1, (Number(row.omzet) || 0) / maximum * 100)
            const edge = index === 0 ? 'left' : index === daily.length - 1 ? 'right' : ''
            return (
              <button
                type="button"
                key={row.tanggal}
                className={`report-chart-bar ${activeIndex === index ? 'active' : ''}`}
                style={{ '--bar-height': `${percent}%` }}
                aria-label={`${formatDate(row.tanggal)}: ${rupiah(row.omzet)}`}
                aria-describedby={activeIndex === index ? `report-chart-tip-${index}` : undefined}
                onPointerEnter={event => { if (event.pointerType === 'mouse') setActiveIndex(index) }}
                onPointerLeave={event => { if (event.pointerType === 'mouse') setActiveIndex(null) }}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(index)}
                onKeyDown={event => { if (event.key === 'Escape') setActiveIndex(null) }}
              >
                <i className="report-chart-bar-fill" />
                {activeIndex === index && <span id={`report-chart-tip-${index}`} className={`report-chart-tooltip ${edge}`} role="tooltip">{formatDate(row.tanggal)} · {rupiah(row.omzet)}</span>}
              </button>
            )
          })}
        </div>
        <div className="report-chart-x-axis">
          {ticks.map(index => <span key={index} className={index === 0 ? 'first' : index === daily.length - 1 ? 'last' : ''}>{formatDate(daily[index].tanggal, { day: 'numeric', month: 'short' })}</span>)}
        </div>
      </div>
    </div>
  )
}

function DailyTable({ report }) {
  const daily = report?.daily || []
  const summary = report?.summary || {}
  return (
    <div className="table-scroll">
      <table className="dashboard-table report-table">
        <thead><tr><th>Tanggal</th><th>Transaksi</th><th>Pcs</th><th>Omzet</th></tr></thead>
        <tbody>
          {daily.length ? daily.map(row => (
            <tr key={row.tanggal}><td>{formatDate(row.tanggal)}</td><td>{integer(row.jumlah_transaksi)}</td><td>{integer(row.total_pcs)}</td><td>{rupiah(row.omzet)}</td></tr>
          )) : <tr><td colSpan="4" className="table-empty">Belum ada penjualan pada periode ini.</td></tr>}
          <tr className="report-total-row"><td>Total</td><td>{integer(summary.jumlah_transaksi)}</td><td>{integer(summary.total_pcs)}</td><td>{rupiah(summary.total_omzet)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

function TopProducts({ products = [] }) {
  return (
    <div className="table-scroll">
      <table className="dashboard-table report-table">
        <thead><tr><th>Produk / varian</th><th>Pcs terjual</th><th>Omzet</th></tr></thead>
        <tbody>
          {products.length ? products.slice(0, 10).map((product, index) => (
            <tr key={`${product.variant_name}-${index}`}><td>{product.variant_name}</td><td>{integer(product.total_pcs)}</td><td>{rupiah(product.total_omzet)}</td></tr>
          )) : <tr><td colSpan="3" className="table-empty">Belum ada produk terjual pada periode ini.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function shortItems(items = []) {
  const labels = items.slice(0, 2).map(item => `${item.variant_name} ×${integer(item.qty)}`)
  if (items.length > 2) labels.push(`+${items.length - 2} lainnya`)
  return labels.join(', ') || '—'
}

function sourceClass(source) {
  return `report-source-badge report-source-${source}`
}

function TransactionDetails({ transactions, loading, error, onRetry, page, lastPage, onPageChange, search, onSearchChange, onClearSearch }) {
  return (
    <Panel title="Rincian transaksi" className="report-details-panel">
      <div className="report-search">
        <Search size={18} />
        <input value={search} maxLength="100" onChange={event => onSearchChange(event.target.value)} placeholder="Cari produk atau kode transaksi" aria-label="Cari produk atau kode transaksi" />
        {search && <button type="button" aria-label="Hapus pencarian" onClick={onClearSearch}><X size={17} /></button>}
      </div>
      {loading ? <div className="report-inline-loading" role="status"><LoaderCircle className="loading-spinner" size={19} /> Memuat rincian transaksi…</div> :
        error ? <ErrorState title="Rincian transaksi tidak dapat dimuat." message={error} onRetry={onRetry} /> :
          transactions.length ? <>
            <div className="table-scroll report-transaction-table-wrap">
              <table className="dashboard-table report-transaction-table">
                <thead><tr><th>Kode</th><th>Waktu</th><th>Sumber</th><th>Isi ringkas</th><th>Total</th></tr></thead>
                <tbody>{transactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>{transaction.code}</td>
                    <td>{transaction.source === 'historis' ? '-' : (transaction.jam || '-').replace(':', '.')}</td>
                    <td><span className={sourceClass(transaction.source)}>{sourceLabels[transaction.source] || transaction.source}</span></td>
                    <td>{shortItems(transaction.items)}</td>
                    <td>{rupiah(transaction.total_amount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="report-transaction-cards">
              {transactions.map(transaction => (
                <article className="report-transaction-card" key={transaction.id}>
                  <header><strong>{transaction.code}</strong><span className={sourceClass(transaction.source)}>{sourceLabels[transaction.source] || transaction.source}</span></header>
                  <p>{formatDate(transaction.tanggal)} · {transaction.source === 'historis' ? '-' : (transaction.jam || '-').replace(':', '.')}</p>
                  <div><span>{shortItems(transaction.items)}</span><strong>{rupiah(transaction.total_amount)}</strong></div>
                </article>
              ))}
            </div>
            <div className="report-pagination">
              <span>Halaman {integer(page)} dari {integer(lastPage)}</span>
              <div>
                <button type="button" className="icon-button" disabled={page <= 1} aria-label="Halaman sebelumnya" onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} /></button>
                <button type="button" className="icon-button" disabled={page >= lastPage} aria-label="Halaman berikutnya" onClick={() => onPageChange(page + 1)}><ChevronRight size={17} /></button>
              </div>
            </div>
          </> : <div className="dashboard-empty report-detail-empty"><Activity size={22} /><strong>Tidak ada transaksi yang cocok.</strong></div>}
    </Panel>
  )
}

function totalFor(transactions, field) {
  return transactions.reduce((sum, item) => sum + (Number(item[field]) || 0), 0)
}

function itemPcs(item) {
  const packSize = item.pack_size == null ? 1 : Number(item.pack_size)
  return (Number(item.qty) || 0) * packSize
}

function summarizeTransactions(transactions, report) {
  const daily = new Map()
  const products = new Map()

  transactions.forEach(transaction => {
    const day = daily.get(transaction.tanggal) || { tanggal: transaction.tanggal, jumlah_transaksi: 0, total_pcs: 0, omzet: 0 }
    day.jumlah_transaksi += 1
    day.total_pcs += Number(transaction.total_pcs) || 0
    day.omzet += Number(transaction.total_amount) || 0
    daily.set(transaction.tanggal, day)

    transaction.items?.forEach(item => {
      const product = products.get(item.variant_name) || { variant_name: item.variant_name, total_pcs: 0, total_omzet: 0 }
      product.total_pcs += itemPcs(item)
      product.total_omzet += Number(item.subtotal) || 0
      products.set(item.variant_name, product)
    })
  })

  const totalAmount = totalFor(transactions, 'total_amount')
  const transactionCount = transactions.length
  return {
    ...report,
    summary: {
      total_omzet: totalAmount,
      jumlah_transaksi: transactionCount,
      total_pcs: totalFor(transactions, 'total_pcs'),
      rata_rata_omzet: transactionCount ? Math.round(totalAmount / transactionCount) : 0,
    },
    daily: [...daily.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    top_products: [...products.values()].sort((a, b) => b.total_pcs - a.total_pcs).slice(0, 10),
  }
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadCsv(filename, rows) {
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Report() {
  const { showToast } = useToast()
  const [source, setSource] = useState('historis')
  const [periodType, setPeriodType] = useState('month')
  const [month, setMonth] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [available, setAvailable] = useState({ min_date: null, max_date: null })
  const [initialized, setInitialized] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [initialRetry, setInitialRetry] = useState(0)
  const [salesRetry, setSalesRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [transactions, setTransactions] = useState([])
  const [transactionPage, setTransactionPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [transactionLoading, setTransactionLoading] = useState(true)
  const [transactionError, setTransactionError] = useState('')
  const [transactionRetry, setTransactionRetry] = useState(0)
  const [preparing, setPreparing] = useState('')
  const [printReady, setPrintReady] = useState(false)
  const [printReport, setPrintReport] = useState(null)
  const [printTransactions, setPrintTransactions] = useState([])
  const [businessName, setBusinessName] = useState('Usaha Saya')
  const [printQuery, setPrintQuery] = useState('')
  const lastSalesKey = useRef(null)
  const salesRequest = useRef(0)
  const transactionRequest = useRef(0)
  const transactionFilterKey = useRef(null)

  useEffect(() => {
    let active = true
    setInitialLoading(true)
    setSalesError('')
    api.reportSales({ source: 'historis' })
      .then(result => {
        if (!active) return
        const data = result.data
        setReport(data)
        setAvailable(data.available)
        setSource('historis')
        setPeriodType('month')
        setFrom(data.period.from)
        setTo(data.period.to)
        setMonth(data.period.from.slice(0, 7))
        lastSalesKey.current = makeFilterKey('historis', data.period.from, data.period.to)
        setInitialized(true)
      })
      .catch(error => {
        if (!active) return
        setSalesError(error.message)
        notifyApiError(error, showToast)
      })
      .finally(() => { if (active) setInitialLoading(false) })

    return () => { active = false }
  }, [initialRetry, showToast])

  useEffect(() => {
    let active = true
    api.getProfile()
      .then(result => {
        if (active) setBusinessName(result.data?.business_name || 'Usaha Saya')
      })
      .catch(error => {
        if (active) {
          setBusinessName('Usaha Saya')
          notifyApiError(error, showToast)
        }
      })
    return () => { active = false }
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  const validationMessage = useMemo(() => rangeError(from, to), [from, to])

  useEffect(() => {
    if (!initialized) return undefined
    if (!from || !to || validationMessage) {
      setSalesLoading(false)
      return undefined
    }

    const key = makeFilterKey(source, from, to)
    if (key === lastSalesKey.current) return undefined
    const timer = window.setTimeout(() => {
      const requestId = ++salesRequest.current
      setSalesLoading(true)
      setSalesError('')
      api.reportSales({ source, from, to })
        .then(result => {
          if (requestId !== salesRequest.current) return
          setReport(result.data)
          setAvailable(result.data.available)
          lastSalesKey.current = key
        })
        .catch(error => {
          if (requestId !== salesRequest.current) return
          setSalesError(error.message)
          notifyApiError(error, showToast)
        })
        .finally(() => {
          if (requestId === salesRequest.current) setSalesLoading(false)
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      salesRequest.current += 1
    }
  }, [from, initialized, salesRetry, showToast, source, to, validationMessage])

  useEffect(() => {
    if (!initialized || !from || !to || validationMessage) {
      setTransactionLoading(false)
      return undefined
    }
    let active = true
    const filterKey = makeFilterKey(source, from, to)
    const delay = transactionFilterKey.current === filterKey ? 0 : 300
    transactionFilterKey.current = filterKey
    const timer = window.setTimeout(() => {
      const requestId = ++transactionRequest.current
      setTransactionLoading(true)
      setTransactionError('')
      api.reportTransactions({
        source,
        from,
        to,
        q: debouncedSearch || undefined,
        per_page: 20,
        page: transactionPage,
      })
        .then(result => {
          if (!active || requestId !== transactionRequest.current) return
          setTransactions(result.data || [])
          setLastPage(result.last_page || 1)
        })
        .catch(error => {
          if (!active || requestId !== transactionRequest.current) return
          setTransactionError(error.message)
          notifyApiError(error, showToast)
        })
        .finally(() => {
          if (active && requestId === transactionRequest.current) setTransactionLoading(false)
        })
    }, delay)

    return () => {
      active = false
      window.clearTimeout(timer)
      transactionRequest.current += 1
    }
  }, [debouncedSearch, from, initialized, showToast, source, to, transactionPage, transactionRetry, validationMessage])

  function retrySales() {
    if (!initialized) setInitialRetry(value => value + 1)
    else {
      lastSalesKey.current = null
      setSalesRetry(value => value + 1)
    }
  }

  function changeMonth(value) {
    setMonth(value)
    const bounds = monthBounds(value)
    setFrom(bounds.from)
    setTo(bounds.to)
    setTransactionPage(1)
  }

  function changeDateRange(field, value) {
    if (field === 'from') {
      setFrom(value)
      if (value) setMonth(value.slice(0, 7))
    } else {
      setTo(value)
    }
    setTransactionPage(1)
  }

  function changeSource(value) {
    setSource(value)
    setTransactionPage(1)
  }

  async function fetchAllTransactions() {
    const params = {
      source,
      from,
      to,
      q: search.trim() || undefined,
      per_page: 1000,
      page: 1,
    }
    const firstPage = await api.reportTransactions(params)
    if (Number(firstPage.total) > 5000) {
      showToast('error', 'Periode terlalu panjang (lebih dari 5.000 transaksi). Persempit periode.')
      return null
    }

    const all = [...(firstPage.data || [])]
    for (let page = 2; page <= Number(firstPage.last_page || 1); page += 1) {
      const result = await api.reportTransactions({ ...params, page })
      if (all.length + (result.data || []).length > 5000) {
        showToast('error', 'Periode terlalu panjang (lebih dari 5.000 transaksi). Persempit periode.')
        return null
      }
      all.push(...(result.data || []))
    }
    return all
  }

  function exportRows(rows, filename) {
    downloadCsv(filename, rows)
    showToast('success', 'Unduhan laporan berhasil disiapkan.')
  }

  async function prepareOutput(kind) {
    if (preparing || !from || !to || validationMessage) return
    setPreparing(kind)
    try {
      const allTransactions = await fetchAllTransactions()
      if (!allTransactions) return
      const filteredReport = summarizeTransactions(allTransactions, report)
      const filenameRange = `${from}_${to}`

      if (kind === 'summary') {
        const rows = [
          ['Tanggal', 'Transaksi', 'Pcs', 'Omzet'],
          ...filteredReport.daily.map(row => [row.tanggal, row.jumlah_transaksi, row.total_pcs, row.omzet]),
          ['Total', filteredReport.summary.jumlah_transaksi, filteredReport.summary.total_pcs, filteredReport.summary.total_omzet],
        ]
        exportRows(rows, `laporan-rekap_${filenameRange}.csv`)
      } else if (kind === 'details') {
        const rows = [
          ['Tanggal', 'Jam', 'Kode', 'Sumber', 'Varian', 'Isi (pcs)', 'Qty', 'Subtotal'],
          ...allTransactions.flatMap(transaction => (transaction.items || []).map(item => [
            transaction.tanggal,
            transaction.source === 'historis' ? '' : (transaction.jam || '').replace(':', '.'),
            transaction.code,
            sourceLabels[transaction.source] || transaction.source,
            item.variant_name,
            itemPcs(item),
            item.qty,
            item.subtotal,
          ])),
        ]
        exportRows(rows, `laporan-rincian_${filenameRange}.csv`)
      } else {
        setPrintReport(filteredReport)
        setPrintTransactions(allTransactions)
        setPrintQuery(search.trim())
        setPrintReady(true)
      }
    } catch (error) {
      notifyApiError(error, showToast)
    } finally {
      setPreparing('')
    }
  }

  useEffect(() => {
    if (!printReady) return undefined
    const frame = window.requestAnimationFrame(() => {
      window.print()
      setPrintReady(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [printReady])

  const label = periodLabel(periodType, month, from, to)
  const summary = report?.summary || {}
  const totalPrintAmount = totalFor(printTransactions, 'total_amount')

  return (
    <section className="report-page">
      <header className="page-header report-page-header report-screen-only">
        <div><p className="eyebrow">Analitik usaha</p><h1>Laporan Penjualan</h1></div>
      </header>

      <div className="report-screen-only"><ReadingGuide /></div>

      <div className="report-toolbar report-screen-only">
        <div className="report-actions">
          <button type="button" className="primary-button" disabled={Boolean(preparing) || !initialized || Boolean(validationMessage)} onClick={() => prepareOutput('print')}>
            {preparing === 'print' ? <><LoaderCircle className="loading-spinner" size={17} /> Menyiapkan laporan...</> : <><Printer size={17} /> Cetak / Simpan PDF</>}
          </button>
          <button type="button" className="secondary-button" disabled={Boolean(preparing) || !initialized || Boolean(validationMessage)} onClick={() => prepareOutput('summary')}>
            {preparing === 'summary' ? <><LoaderCircle className="loading-spinner" size={17} /> Menyiapkan laporan...</> : <><Download size={17} /> CSV Rekap</>}
          </button>
          <button type="button" className="secondary-button" disabled={Boolean(preparing) || !initialized || Boolean(validationMessage)} onClick={() => prepareOutput('details')}>
            {preparing === 'details' ? <><LoaderCircle className="loading-spinner" size={17} /> Menyiapkan laporan...</> : <><Download size={17} /> CSV Rincian</>}
          </button>
        </div>

        <div className="report-filters">
          <label>Periode
            <select value={periodType} disabled={!initialized || Boolean(preparing)} onChange={event => {
              const nextType = event.target.value
              setPeriodType(nextType)
              if (nextType === 'month' && from) changeMonth(from.slice(0, 7))
            }}>
              <option value="month">Per bulan</option>
              <option value="range">Rentang tanggal</option>
            </select>
          </label>
          {periodType === 'month' ? (
            <label>Bulan
              <input
                type="month"
                value={month}
                min={available.min_date?.slice(0, 7)}
                max={available.max_date?.slice(0, 7)}
              disabled={!initialized || Boolean(preparing)}
                onChange={event => changeMonth(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>Dari
                <input type="date" value={from} min={available.min_date || undefined} max={available.max_date || undefined} disabled={!initialized || Boolean(preparing)} onChange={event => changeDateRange('from', event.target.value)} />
              </label>
              <label>Sampai
                <input type="date" value={to} min={available.min_date || undefined} max={available.max_date || undefined} disabled={!initialized || Boolean(preparing)} onChange={event => changeDateRange('to', event.target.value)} />
              </label>
              {validationMessage && <p className="report-validation" role="alert">{validationMessage}</p>}
            </>
          )}
          <label>Sumber data
            <select value={source} disabled={!initialized || Boolean(preparing)} onChange={event => changeSource(event.target.value)}>
              <option value="historis">Historis</option>
              <option value="semua">Semua sumber</option>
              <option value="simulasi">Simulasi</option>
              <option value="kasir">Kasir</option>
            </select>
          </label>
        </div>
      </div>

      {!initialized && initialLoading ? <LoadingState /> :
        !initialized && salesError ? <ErrorState title="Laporan tidak dapat dimuat." message={salesError} onRetry={retrySales} /> :
          salesLoading ? <LoadingState message="Sebentar ya, sedang memuat laporan…" /> :
            salesError ? <ErrorState title="Laporan tidak dapat dimuat." message={salesError} onRetry={retrySales} /> :
              <>
                <div className="report-content report-screen-only">
                  <div className="metric-grid">
                    <MetricCard label="Total omzet" value={rupiah(summary.total_omzet)} note="Akumulasi penjualan pada periode ini" />
                    <MetricCard label="Transaksi" value={integer(summary.jumlah_transaksi)} note="Jumlah transaksi pada periode ini" />
                    <MetricCard label="Pcs terjual" value={`${integer(summary.total_pcs)} pcs`} note="Jumlah isi kemasan terjual" />
                    <MetricCard label="Rata-rata per transaksi" value={rupiah(summary.rata_rata_omzet)} note="Omzet dibagi jumlah transaksi" />
                  </div>
                  <Conclusion report={report} source={source} label={label} />
                  <Panel title="Omzet per hari" description="Pilih batang untuk melihat tanggal dan omzetnya." className="chart-panel">
                    <DailyChart daily={report?.daily} />
                  </Panel>
                  <Panel title="Rekap per hari"><DailyTable report={report} /></Panel>
                  <Panel title="Produk teratas"><TopProducts products={report?.top_products} /></Panel>
                  <TransactionDetails
                    transactions={transactions}
                    loading={transactionLoading}
                    error={transactionError}
                    onRetry={() => setTransactionRetry(value => value + 1)}
                    page={transactionPage}
                    lastPage={lastPage}
                    onPageChange={setTransactionPage}
                    search={search}
                    onSearchChange={value => { setSearch(value); setTransactionPage(1) }}
                    onClearSearch={() => { setSearch(''); setDebouncedSearch(''); setTransactionPage(1) }}
                  />
                </div>

                <div className="report-print-only">
                  <header className="report-print-header">
                    <div className="report-print-brand"><span className="brand-mark">S</span><div><h1>Laporan Penjualan</h1><strong>{businessName}</strong></div></div>
                    <div className="report-print-meta">
                      <span>Periode: {label}</span>
                      <span>Sumber data: {sourceLabel(source)}</span>
                      {printQuery && <span>Pencarian: {printQuery}</span>}
                      <span>Tanggal cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </header>
                  <div className="metric-grid report-print-metrics">
                    <MetricCard label="Total omzet" value={rupiah(printReport?.summary.total_omzet)} note="Akumulasi penjualan" />
                    <MetricCard label="Transaksi" value={integer(printReport?.summary.jumlah_transaksi)} note="Jumlah transaksi" />
                    <MetricCard label="Pcs terjual" value={`${integer(printReport?.summary.total_pcs)} pcs`} note="Isi kemasan terjual" />
                    <MetricCard label="Rata-rata per transaksi" value={rupiah(printReport?.summary.rata_rata_omzet)} note="Rata-rata omzet" />
                  </div>
                  <Conclusion report={printReport} source={source} label={label} />
                  <Panel title="Omzet per hari"><DailyChart daily={printReport?.daily} /></Panel>
                  <Panel title="Rekap per hari"><DailyTable report={printReport} /></Panel>
                  <Panel title="Produk teratas"><TopProducts products={printReport?.top_products} /></Panel>
                  <Panel title="RINCIAN TRANSAKSI LENGKAP" className="report-print-details">
                    <div className="table-scroll">
                      <table className="dashboard-table report-print-table">
                        <thead><tr><th>Tanggal</th><th>Waktu</th><th>Kode</th><th>Isi ringkas</th><th>Total</th></tr></thead>
                        <tbody>
                          {printTransactions.map(transaction => (
                            <tr key={transaction.id}>
                              <td>{formatDate(transaction.tanggal)}</td>
                              <td>{transaction.source === 'historis' ? '-' : (transaction.jam || '-').replace(':', '.')}</td>
                              <td>{transaction.code}</td>
                              <td>{shortItems(transaction.items)}</td>
                              <td>{rupiah(transaction.total_amount)}</td>
                            </tr>
                          ))}
                          {!printTransactions.length && <tr><td colSpan="5" className="table-empty">Tidak ada transaksi yang cocok.</td></tr>}
                          <tr className="report-total-row"><td colSpan="4">Total rincian</td><td>{rupiah(totalPrintAmount)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                  <footer className="report-print-footer">Dicetak dari Sava</footer>
                </div>
              </>}

    </section>
  )
}
