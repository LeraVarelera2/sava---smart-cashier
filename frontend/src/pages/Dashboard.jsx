import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, CircleHelp, Info, LoaderCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { api, notifyApiError } from '../api'
import { useToast } from '../components/ToastProvider'

const tabs = [
  ['ringkasan', 'Ringkasan'],
  ['prediksi', 'Prediksi'],
  ['produk', 'Produk'],
  ['bundling', 'Bundling'],
]

const rupiah = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const integer = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0)
const tabHelp = {
  ringkasan: 'Halaman ini merangkum penjualan usaha: omzet, jumlah transaksi, produk paling laku, serta hari dan jam paling ramai. Pilih Sumber data dan Rentang di atas. Historis = catatan penjualan asli Mei-November. Simulasi = data contoh buatan untuk 30 hari terakhir, dipakai menguji fitur jam sibuk dan bundling per transaksi; bukan penjualan nyata. Kasir = transaksi yang dicatat lewat halaman Kasir.',
  prediksi: 'Memperkirakan omzet harian 7 hari ke depan dari pola penjualan sebelumnya (hari dalam minggu dan tren). Ini perkiraan, bukan kepastian. Garis penuh = omzet sebenarnya, garis putus-putus = perkiraan.',
  produk: "Mengelompokkan setiap varian menjadi Laris, Kurang Laris, atau Tidak Laris berdasarkan jumlah terjual per minggu, lalu memperkirakan kelasnya minggu depan. 'Data belum cukup' berarti varian itu terjual kurang dari 4 minggu. Akurasi = persentase tebakan model yang benar pada data uji.",
  bundling: 'Mencari produk yang sering terjual bersamaan sebagai ide paket hemat. Support = seberapa sering kombinasi itu muncul (20% berarti 1 dari 5 keranjang). Confidence = jika produk A dibeli, seberapa sering produk B ikut dibeli. Lift = seberapa kuat hubungannya dibanding kebetulan; di atas 1 berarti lebih sering bersama daripada kebetulan, makin besar makin kuat. Per hari = semua varian yang terjual di hari yang sama dianggap satu keranjang; per transaksi = satu nota satu keranjang.',
}

function periodLabel(value) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
  }
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function EmptyState({ title, children }) {
  return <div className="dashboard-empty"><Activity size={22} /><strong>{title}</strong>{children && <span>{children}</span>}</div>
}

function TabHelp({ tab, children }) {
  const [expanded, setExpanded] = useState(true)
  const contentId = `dashboard-help-${tab}`

  return (
    <aside className="dashboard-help">
      <button type="button" className="dashboard-help-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
        <Info size={17} />
        <span>Apa ini?</span>
        {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      <div id={contentId} className="dashboard-help-content" hidden={!expanded}><p>{children}</p></div>
    </aside>
  )
}

function InfoTooltip({ label, description }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <span className="metric-help" data-open={expanded}>
      <button type="button" aria-label={`Penjelasan ${label}`} aria-expanded={expanded} title={description} onClick={() => setExpanded(value => !value)}>
        <CircleHelp size={14} />
      </button>
      <span className="metric-tooltip" role="tooltip">{description}</span>
    </span>
  )
}

function Panel({ title, description, children, className = '' }) {
  return (
    <article className={`dashboard-panel ${className}`}>
      <header><h2>{title}</h2><p>{description}</p></header>
      {children}
    </article>
  )
}

function MetricCard({ label, value, note }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function LineChart({ labels, series, ariaLabel }) {
  const [activePoint, setActivePoint] = useState(null)
  const width = 780
  const height = 250
  const pad = { top: 16, right: 12, bottom: 40, left: 72 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const values = series.flatMap(item => item.values.filter(Number.isFinite))
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const y = value => pad.top + (max - value) / (max - min || 1) * plotHeight
  const x = index => pad.left + index * plotWidth / Math.max(1, labels.length - 1)
  const showPoint = (item, index) => {
    const value = item.values[index]
    if (!Number.isFinite(value)) return
    setActivePoint({ series: item.name, label: labels[index], value: rupiah(value), x: x(index), y: y(value) })
  }

  function pathsFor(valuesToPlot) {
    const paths = []
    let active = []
    valuesToPlot.forEach((value, index) => {
      if (Number.isFinite(value)) {
        active.push(`${active.length ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      } else if (active.length) {
        paths.push(active.join(' '))
        active = []
      }
    })
    if (active.length) paths.push(active.join(' '))
    return paths
  }

  if (!values.length) return <EmptyState title="Belum ada data untuk digambarkan." />

  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {[0, 1, 2, 3].map(step => {
          const value = max - (max - min) * step / 3
          const yPos = y(value)
          return <g key={step}><line x1={pad.left} x2={width - pad.right} y1={yPos} y2={yPos} className="chart-gridline" /><text x={pad.left - 10} y={yPos + 4} textAnchor="end" className="chart-axis-label">{integer(value)}</text></g>
        })}
        {series.map(item => pathsFor(item.values).map((path, index) => <path key={`${item.name}-${index}`} d={path} fill="none" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '7 6' : undefined} strokeLinecap="round" strokeLinejoin="round" />))}
        {series.map(item => item.values.map((value, index) => Number.isFinite(value) && (
          <g
            key={`${item.name}-point-${index}`}
            className="chart-point"
            role="button"
            tabIndex="0"
            aria-label={`${item.name}, ${periodLabel(labels[index])}: ${rupiah(value)}`}
            onPointerEnter={() => showPoint(item, index)}
            onPointerLeave={event => { if (event.pointerType !== 'touch') setActivePoint(null) }}
            onFocus={() => showPoint(item, index)}
            onBlur={() => setActivePoint(null)}
            onClick={() => showPoint(item, index)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                showPoint(item, index)
              }
              if (event.key === 'Escape') setActivePoint(null)
            }}
          >
            <circle className="chart-point-hitarea" cx={x(index)} cy={y(value)} r="12" />
            {activePoint?.series === item.name && activePoint?.label === labels[index] && <circle className="chart-active-dot-outline" cx={x(index)} cy={y(value)} r="8" />}
            <circle className="chart-point-dot" cx={x(index)} cy={y(value)} r={activePoint?.series === item.name && activePoint?.label === labels[index] ? 5 : 2.6} fill={item.color} />
          </g>
        )))}
        {[0, Math.floor((labels.length - 1) / 2), labels.length - 1].filter((value, index, list) => labels.length && list.indexOf(value) === index).map(index => (
          <text key={index} x={x(index)} y={height - 12} textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'} className="chart-axis-label">{periodLabel(labels[index])}</text>
        ))}
      </svg>
      {activePoint && (
        <div
          className={`chart-tooltip ${activePoint.y < 76 ? 'below' : ''}`}
          role="tooltip"
          style={{ left: `clamp(132px, ${(activePoint.x / width) * 100}%, calc(100% - 132px))`, top: `${(activePoint.y / height) * 100}%` }}
        >
          <strong>{periodLabel(activePoint.label)}</strong>
          <span>{activePoint.series} · {activePoint.value}</span>
        </div>
      )}
      <div className="chart-legend">{series.map(item => <span key={item.name}><i style={{ backgroundColor: item.color }} />{item.name}</span>)}</div>
    </div>
  )
}

function BarList({ items, value, label, display }) {
  const [activeIndex, setActiveIndex] = useState(null)
  if (!items.length) return <EmptyState title="Belum ada data pada pilihan ini." />
  const maximum = Math.max(1, ...items.map(item => Number(value(item)) || 0))
  return (
    <div className="bar-list">
      {items.map((item, index) => (
        <div
          className={`bar-row ${activeIndex === index ? 'is-active' : ''}`}
          key={`${label(item)}-${index}`}
          tabIndex="0"
          role="button"
          aria-label={`${label(item)}: ${display(item)}`}
          aria-expanded={activeIndex === index}
          data-tooltip={`${label(item)}: ${display(item)}`}
          data-open={activeIndex === index}
          onPointerEnter={event => { if (event.pointerType === 'mouse') setActiveIndex(index) }}
          onPointerLeave={event => { if (event.pointerType === 'mouse') setActiveIndex(null) }}
          onFocus={() => setActiveIndex(index)}
          onBlur={() => setActiveIndex(null)}
          onClick={() => setActiveIndex(index)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActiveIndex(index)
            }
            if (event.key === 'Escape') setActiveIndex(null)
          }}
        >
          <span className="bar-label">{label(item)}</span>
          <span className="bar-track">
            <i style={{ width: `${Math.max(2, (Number(value(item)) || 0) / maximum * 100)}%` }} />
            {activeIndex === index && <b className="bar-active-dot" style={{ left: `${Math.max(2, (Number(value(item)) || 0) / maximum * 100)}%` }} />}
          </span>
          <strong>{display(item)}</strong>
        </div>
      ))}
    </div>
  )
}

function TopProductsTable({ products }) {
  const [activeProduct, setActiveProduct] = useState(null)

  return (
    <div className="table-scroll">
      <table className="dashboard-table">
        <thead><tr><th>Varian</th><th>Unit</th><th>Omzet</th></tr></thead>
        <tbody>
          {products.length ? products.map(product => {
            const details = `${product.variant_name}: ${integer(product.total_pcs)} unit · ${rupiah(product.total_omzet)}`
            return (
              <tr key={product.variant_name}>
                <td>
                  <button type="button" className="table-tooltip-trigger" title={details} aria-expanded={activeProduct === product.variant_name} onClick={() => setActiveProduct(current => current === product.variant_name ? null : product.variant_name)}>
                    {product.variant_name}
                  </button>
                  {activeProduct === product.variant_name && <span className="table-tooltip-bubble" role="tooltip">{details}</span>}
                </td>
                <td>{integer(product.total_pcs)}</td>
                <td>{rupiah(product.total_omzet)}</td>
              </tr>
            )
          }) : <TableEmpty columns={3} message="Belum ada penjualan produk." />}
        </tbody>
      </table>
    </div>
  )
}

function TableEmpty({ columns, message }) {
  return <tr><td colSpan={columns} className="table-empty">{message}</td></tr>
}

function ProductStatus({ value }) {
  const normalized = String(value || '').toLowerCase()
  const status = normalized === 'laris' ? ['laris', 'Laris']
    : normalized === 'kurang laris' ? ['kurang-laris', 'Kurang Laris']
      : normalized === 'tidak laris' ? ['tidak-laris', 'Tidak Laris']
        : ['data-belum-cukup', 'Data belum cukup']
  return <span className={`classification-badge ${status[0]}`}>{status[1]}</span>
}

function ClassificationTable({ products }) {
  return (
    <div className="table-scroll">
      <table className="dashboard-table">
        <thead><tr><th>Varian</th><th>Klasifikasi terakhir</th><th>Prediksi minggu depan</th></tr></thead>
        <tbody>
          {products.length ? products.map(product => (
            <tr key={product.variant_name}>
              <td>{product.variant_name}</td>
              <td><ProductStatus value={product.kelas_aktual_minggu_terakhir} /></td>
              <td><ProductStatus value={product.prediksi_minggu_depan} /></td>
            </tr>
          )) : <TableEmpty columns={3} message="Belum ada hasil klasifikasi produk." />}
        </tbody>
      </table>
    </div>
  )
}

function ConfusionMatrix({ matrix }) {
  if (!matrix?.labels?.length || !matrix.values?.length) return <EmptyState title="Confusion matrix belum tersedia." />
  return (
    <div className="table-scroll">
      <table className="confusion-table">
        <caption>Baris = kelas aktual · kolom = kelas prediksi</caption>
        <thead><tr><th>Aktual ↓ / Prediksi →</th>{matrix.labels.map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{matrix.values.map((row, rowIndex) => <tr key={matrix.labels[rowIndex]}><th>{matrix.labels[rowIndex]}</th>{row.map((count, columnIndex) => <td key={`${rowIndex}-${columnIndex}`}>{count}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function BundlingCards({ result }) {
  if (!result?.data?.length) return <EmptyState title="Belum ditemukan pola bundling yang kuat." />
  const tooltipCopy = {
    Support: 'Support: seberapa sering kombinasi ini muncul di semua keranjang. 20% berarti 1 dari 5 keranjang.',
    Confidence: 'Confidence: jika produk A dibeli, seberapa sering produk B ikut dibeli.',
    Lift: 'Lift: kekuatan hubungan dibanding kebetulan. Di atas 1 berarti lebih sering bersama; makin besar makin kuat.',
  }
  return (
    <div className="bundle-grid">
      {result.data.map(rule => (
        <article className="bundle-card" key={`${rule.item_a}-${rule.item_b}`}>
          <p className="eyebrow">Rekomendasi paket</p>
          <h3>{rule.item_a} <span>+</span> {rule.item_b}</h3>
          <p className="bundle-sentence">{rule.sentence || `${rule.item_a} dan ${rule.item_b} cenderung dibeli bersama.`}</p>
          <div className="bundle-stats">
            <span><strong>{(rule.support * 100).toFixed(1)}%</strong><span className="bundle-stat-label">Support <InfoTooltip label="Support" description={tooltipCopy.Support} /></span></span>
            <span><strong>{(rule.confidence * 100).toFixed(1)}%</strong><span className="bundle-stat-label">Confidence <InfoTooltip label="Confidence" description={tooltipCopy.Confidence} /></span></span>
            <span><strong>{rule.lift.toFixed(2)}×</strong><span className="bundle-stat-label">Lift <InfoTooltip label="Lift" description={tooltipCopy.Lift} /></span></span>
          </div>
          <small>Nilai ini merangkum seberapa sering pasangan muncul dan seberapa kuat hubungannya.</small>
        </article>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [source, setSource] = useState('semua')
  const [range, setRange] = useState('30')
  const [basis, setBasis] = useState('day')
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [busyDays, setBusyDays] = useState([])
  const [busyHours, setBusyHours] = useState({ data: [], message: null })
  const [forecast, setForecast] = useState(null)
  const [classification, setClassification] = useState(null)
  const [bundlings, setBundlings] = useState(null)

  useEffect(() => {
    if (activeTab !== 'ringkasan') return
    let current = true
    setLoading(true); setError('')
    const params = { source, range }
    Promise.all([
      api.dashboardSummary(params),
      api.dashboardTrend(params),
      api.dashboardTopProducts(params),
      api.dashboardBusyDays(params),
      api.dashboardBusyHours(params),
    ]).then(([summaryResult, trendResult, productsResult, daysResult, hoursResult]) => {
      if (!current) return
      setSummary(summaryResult.data)
      setTrend(trendResult.data || [])
      setTopProducts(productsResult.data || [])
      setBusyDays(daysResult.data || [])
      setBusyHours(hoursResult)
    }).catch(apiError => {
      if (!current) return
      setError(apiError.message)
      notifyApiError(apiError, showToast)
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [activeTab, source, range, retry, showToast])

  useEffect(() => {
    if (activeTab !== 'prediksi') return
    let current = true
    setLoading(true); setError('')
    api.forecast(7).then(result => { if (current) setForecast(result) }).catch(apiError => {
      if (!current) return
      setError(apiError.message)
      notifyApiError(apiError, showToast)
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [activeTab, retry, showToast])

  useEffect(() => {
    if (activeTab !== 'produk') return
    let current = true
    setLoading(true); setError('')
    api.classification().then(result => { if (current) setClassification(result) }).catch(apiError => {
      if (!current) return
      setError(apiError.message)
      notifyApiError(apiError, showToast)
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [activeTab, retry, showToast])

  useEffect(() => {
    if (activeTab !== 'bundling') return
    let current = true
    setLoading(true); setError('')
    Promise.all([api.bundling('day'), api.bundling('transaction')]).then(([day, transaction]) => {
      if (current) setBundlings({ day, transaction })
    }).catch(apiError => {
      if (!current) return
      setError(apiError.message)
      notifyApiError(apiError, showToast)
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [activeTab, retry, showToast])

  const activeBundling = bundlings?.[basis]
  const metric = forecast?.metrics || {}
  const classificationMetrics = classification?.metrics || {}
  const excludedCount = classificationMetrics.excluded_variant_count ?? 0
  const maeInThousands = metric.mae !== null && metric.mae !== undefined && Number.isFinite(Number(metric.mae))
    ? `Rp${integer(Math.round(Number(metric.mae) / 1000))} ribu`
    : 'nilai MAE'
  const hasLowR2 = metric.r2 !== null && metric.r2 !== undefined && Number.isFinite(Number(metric.r2)) && Number(metric.r2) < 0.3

  return (
    <section className="dashboard-page">
      <header className="page-header dashboard-header">
        <div><p className="eyebrow">Analitik usaha</p><h1>Dashboard</h1></div>
        <button type="button" className="secondary-button dashboard-refresh" onClick={() => setRetry(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Coba lagi</button>
      </header>

      <div className="dashboard-filters">
        <label>Sumber data
          <select value={source} onChange={event => setSource(event.target.value)}>
            <option value="semua">Semua sumber</option>
            <option value="historis">Historis</option>
            <option value="simulasi">Simulasi</option>
            <option value="kasir">Kasir</option>
          </select>
        </label>
        <label>Rentang
          <select value={range} onChange={event => setRange(event.target.value)}>
            <option value="7">7 hari</option>
            <option value="30">30 hari</option>
            <option value="90">90 hari</option>
            <option value="semua">Semua data</option>
          </select>
        </label>
      </div>
      <p className="dashboard-filter-note">Filter sumber dan rentang berlaku untuk Ringkasan. Prediksi serta klasifikasi mengikuti model historis; Bundling dapat memilih basisnya sendiri.</p>

      <div className="dashboard-tabs" role="tablist" aria-label="Bagian dashboard">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}
      </div>
      <TabHelp key={activeTab} tab={activeTab}>{tabHelp[activeTab]}</TabHelp>

      {loading ? <div className="dashboard-loading" role="status" aria-live="polite">
        <div className="dashboard-loading-skeletons" aria-hidden="true"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
        <div className="dashboard-loading-status"><LoaderCircle className="loading-spinner" size={20} /><span>{activeTab === 'prediksi' || activeTab === 'bundling' ? 'Sedang menghitung… mohon tunggu sebentar' : 'Sebentar ya, sedang memuat data…'}</span></div>
      </div> :
        error ? <div className="dashboard-error" role="alert"><strong>Data dashboard tidak dapat dimuat.</strong><span>{error}</span><button type="button" className="primary-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} /> Coba lagi</button></div> :
          <>
            {activeTab === 'ringkasan' && <div className="dashboard-content">
              <div className="metric-grid">
                <MetricCard label="Total omzet" value={rupiah(summary?.total_omzet)} note="Akumulasi penjualan pada filter terpilih" />
                <MetricCard label="Transaksi" value={integer(summary?.jumlah_transaksi)} note="Jumlah transaksi pada filter terpilih" />
                <MetricCard label="Produk terjual" value={`${integer(summary?.total_pcs)} pcs`} note="Jumlah unit dari kemasan yang tercatat" />
                <MetricCard label="Rata-rata transaksi" value={rupiah(summary?.rata_rata_omzet)} note="Omzet dibagi jumlah transaksi" />
              </div>
              <Panel title="Tren omzet" description="Garis menunjukkan perubahan omzet; titik lebih tinggi berarti penjualan lebih besar." className="chart-panel">
                {trend.length ? <LineChart labels={trend.map(row => row.period)} series={[{ name: 'Omzet', color: 'var(--forest-2)', values: trend.map(row => Number(row.omzet)) }]} ariaLabel="Grafik tren omzet" /> : <EmptyState title="Belum ada transaksi pada filter ini." />}
              </Panel>
              <div className="dashboard-two-column">
                <Panel title="Produk terlaris" description="Produk diurutkan dari jumlah unit terjual terbanyak.">
                  <TopProductsTable products={topProducts} />
                </Panel>
                <Panel title="Hari tersibuk" description="Batang menunjukkan rata-rata omzet per hari dalam seminggu.">
                  <BarList items={busyDays} label={item => item.hari} value={item => item.rata_rata_omzet} display={item => rupiah(item.rata_rata_omzet)} />
                </Panel>
                <Panel title="Jam transaksi" description="Jumlah transaksi dikelompokkan menurut jam terjadinya.">
                  {busyHours.data?.length ? <BarList items={busyHours.data} label={item => `${String(item.jam).padStart(2, '0')}.00`} value={item => item.jumlah_transaksi} display={item => `${integer(item.jumlah_transaksi)} transaksi`} /> : <EmptyState title={busyHours.message || 'Belum ada data jam transaksi.'} />}
                </Panel>
              </div>
            </div>}

            {activeTab === 'prediksi' && <div className="dashboard-content">
              <Panel title="Omzet aktual dan prediksi 7 hari" description="Garis penuh adalah omzet historis 30 hari terakhir; garis putus-putus menunjukkan perkiraan untuk 7 hari berikutnya." className="chart-panel">
                {forecast?.history?.length && forecast?.forecast?.length ? (() => {
                  const history = forecast.history
                  const future = forecast.forecast
                  const labels = [...history.map(row => row.tanggal), ...future.map(row => row.tanggal)]
                  const actualValues = [...history.map(row => Number(row.omzet)), ...future.map(() => null)]
                  const predictedValues = [...history.map(() => null), ...future.map(row => Number(row.omzet))]
                  predictedValues[history.length - 1] = Number(history[history.length - 1].omzet)
                  return <LineChart labels={labels} series={[
                    { name: 'Aktual', color: 'var(--forest-2)', values: actualValues },
                    { name: 'Prediksi', color: 'var(--apricot)', values: predictedValues, dashed: true },
                  ]} ariaLabel="Grafik 30 hari omzet aktual dan 7 hari prediksi" />
                })() : <EmptyState title="Data prediksi belum tersedia." />}
              </Panel>
              <div className="metric-grid forecast-metrics">
                <MetricCard label="MAE" value={rupiah(metric.mae)} note={`Rata-rata selisih antara perkiraan dan kenyataan per hari. Contoh: ${maeInThousands} artinya perkiraan rata-rata meleset sekitar ${maeInThousands} per hari. Makin kecil makin baik.`} />
                <MetricCard label="RMSE" value={rupiah(metric.rmse)} note="Mirip MAE, tetapi hari dengan selisih besar dihitung lebih berat. Dipakai untuk melihat apakah ada hari yang meleset jauh. Makin kecil makin baik." />
                <MetricCard label="R²" value={Number.isFinite(Number(metric.r2)) ? Number(metric.r2).toFixed(3) : '—'} note="Seberapa cocok pola model dengan data, skala 0 sampai 1. Mendekati 1 berarti sangat cocok; mendekati 0 berarti model baru sedikit lebih baik daripada menebak rata-rata." />
              </div>
              <p className="model-note"><TrendingUp size={16} /> Prediksi dimulai setelah data historis terakhir ({metric.last_historical_date || 'tanggal belum tersedia'}). Angka ini perkiraan, bukan jaminan penjualan.</p>
              {hasLowR2 && <p className="model-note model-warning"><TrendingUp size={16} /> Omzet harian usaha ini naik-turun tidak menentu, jadi perkiraan hanya gambaran kasar, bukan kepastian.</p>}
            </div>}

            {activeTab === 'produk' && <div className="dashboard-content">
              <Panel title="Klasifikasi produk" description="Klasifikasi terakhir dibandingkan dengan prediksi kelas penjualan untuk minggu depan.">
                <ClassificationTable products={classification?.products || []} />
              </Panel>
              <div className="dashboard-two-column product-insights">
                <Panel title="Ringkasan akurasi" description="Akurasi uji adalah bagian prediksi kelas yang tepat pada data evaluasi.">
                  <div className="classification-summary">
                    <strong>{Number.isFinite(Number(classificationMetrics.accuracy_test)) ? `${(Number(classificationMetrics.accuracy_test) * 100).toFixed(1)}%` : '—'}</strong>
                    <span>Akurasi uji · {integer(classificationMetrics.testing_rows)} data</span>
                    <p>{integer(excludedCount)} varian dikecualikan karena data kurang dari 4 minggu dan ditampilkan sebagai “Data belum cukup”.</p>
                  </div>
                </Panel>
                <Panel title="Confusion matrix" description="Diagonal menunjukkan jumlah klasifikasi uji yang sesuai dengan kelas aktual.">
                  <ConfusionMatrix matrix={classificationMetrics.confusion_matrix} />
                </Panel>
              </div>
              <Panel title="Aturan pohon keputusan" description="Cabang di bawah menunjukkan aturan yang digunakan model untuk menentukan kelas.">
                {classification?.tree_rules ? <details className="tree-details"><summary>Buka aturan lengkap</summary><pre>{classification.tree_rules}</pre></details> : <EmptyState title="Aturan model belum tersedia." />}
              </Panel>
            </div>}

            {activeTab === 'bundling' && <div className="dashboard-content">
              <div className="bundling-controls">
                <div><p className="eyebrow">Dasar perhitungan</p><h2>Pilih basis bundling</h2></div>
                <div className="segmented-control" role="group" aria-label="Basis bundling">
                  <button type="button" className={basis === 'day' ? 'active' : ''} aria-pressed={basis === 'day'} onClick={() => setBasis('day')}>Per hari</button>
                  <button type="button" className={basis === 'transaction' ? 'active' : ''} aria-pressed={basis === 'transaction'} onClick={() => setBasis('transaction')}>Per transaksi</button>
                </div>
              </div>
              <div className="bundle-count-grid">
                <article className={basis === 'day' ? 'selected' : ''}><span>Aturan basis per hari</span><strong>{integer(bundlings?.day?.rule_count ?? bundlings?.day?.data?.length)}</strong></article>
                <article className={basis === 'transaction' ? 'selected' : ''}><span>Aturan basis per transaksi</span><strong>{integer(bundlings?.transaction?.rule_count ?? bundlings?.transaction?.data?.length)}</strong></article>
              </div>
              <Panel title={basis === 'day' ? 'Paket dari pembelian per hari' : 'Paket dari pembelian per transaksi'} description={basis === 'day' ? 'Satu keranjang berarti semua produk yang terjual pada hari yang sama.' : 'Satu keranjang berarti produk-produk dalam satu transaksi kasir atau simulasi.'}>
                <BundlingCards result={activeBundling} />
              </Panel>
            </div>}
          </>}
    </section>
  )
}
