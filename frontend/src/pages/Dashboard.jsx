import { useEffect, useRef, useState } from 'react'
import { Activity, BookOpen, CheckCircle2, Info, LoaderCircle, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
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
  ringkasan: {
    summary: 'Gambaran penjualan usahamu.',
    points: [
      'Historis = catatan penjualan asli.',
      'Simulasi = data contoh buatan, bukan penjualan nyata.',
      'Kasir = transaksi dari halaman Kasir.',
    ],
  },
  prediksi: {
    summary: 'Perkiraan omzet 7 hari ke depan.',
    points: [
      'Garis penuh = omzet sebenarnya.',
      'Garis putus-putus = perkiraan.',
      'Perkiraan hanya gambaran kasar, bukan kepastian.',
    ],
  },
  produk: {
    summary: 'Produk mana yang laris dan tidak.',
    points: [
      'Laris, Kurang laris, Tidak laris dihitung dari jumlah terjual per minggu.',
      '"Data belum cukup" = terjual kurang dari 4 minggu.',
    ],
  },
  bundling: {
    summary: 'Produk yang sering dibeli bersamaan, cocok dijadikan paket.',
    groups: [
      {
        title: 'Angka di kartu',
        points: [
          'Muncul bersama = seberapa sering dua produk terjual bersamaan.',
          'Ikut dibeli = jika A dibeli, seberapa sering B ikut.',
          'Kekuatan = di atas 1x berarti hubungannya nyata, bukan kebetulan.',
        ],
      },
      {
        title: 'Pilihan pengelompokan',
        points: [
          'Per hari = produk yang terjual di hari yang sama dihitung satu keranjang (untuk data historis tanpa nota).',
          'Per transaksi = satu nota satu keranjang (untuk data Simulasi dan Kasir).',
          'Jumlah pasangan = banyaknya pasangan produk yang ditemukan; "per hari 5" berarti ada 5 pasangan menurut dasar per hari.',
        ],
      },
    ],
  },
}

const sourceLabels = { semua: 'Semua sumber', historis: 'Historis', simulasi: 'Simulasi', kasir: 'Kasir' }
const rangeLabels = { '7': '7 hari terakhir', '30': '30 hari terakhir', '90': '90 hari terakhir', semua: 'semua data' }

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

function TabHelp({ children }) {
  const groups = children.groups || [{ points: children.points }]

  return (
    <>
      <aside className="dashboard-help">
        <div className="dashboard-help-row">
          <Info size={17} />
          <p><strong>{children.summary}</strong></p>
        </div>
      </aside>
      <aside className="dashboard-reading-guide" aria-label="Cara membaca">
        <header className="dashboard-reading-title"><BookOpen size={17} /><h2>Cara membaca</h2></header>
        <div className="dashboard-reading-groups">
          {groups.map((group, groupIndex) => (
            <section className="dashboard-reading-group" key={group.title || groupIndex}>
              {group.title && <h3>{group.title}</h3>}
              <ul>
                {group.points.map((point, pointIndex) => <li key={pointIndex}><CheckCircle2 size={16} /><span>{point}</span></li>)}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
  )
}

function Conclusion({ children }) {
  return <aside className="dashboard-conclusion"><Sparkles size={17} /><div><h2>Kesimpulan</h2><p>{children}</p></div></aside>
}

function Panel({ title, description, children, className = '' }) {
  return (
    <article className={`dashboard-panel ${className}`}>
      <header><h2>{title}</h2>{description && <p>{description}</p>}</header>
      {children}
    </article>
  )
}

function MetricCard({ label, value, note, badge }) {
  return <article className="metric-card"><div className="metric-card-label"><span>{label}</span>{badge && <small>{badge}</small>}</div><strong>{value}</strong><small>{note}</small></article>
}

function LineChart({ labels, series, ariaLabel }) {
  const [activePoint, setActivePoint] = useState(null)
  const chartRef = useRef(null)
  const wrapperRef = useRef(null)
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
    const chartBounds = chartRef.current.getBoundingClientRect()
    const wrapperBounds = wrapperRef.current.getBoundingClientRect()
    const pointX = chartBounds.left - wrapperBounds.left + x(index) / width * chartBounds.width
    const pointY = chartBounds.top - wrapperBounds.top + y(value) / height * chartBounds.height
    setActivePoint({
      series: item.name,
      label: labels[index],
      value: rupiah(value),
      x: Math.max(8, Math.min(wrapperBounds.width - 8, pointX)),
      y: pointY,
      align: pointX < 110 ? 'left' : pointX > wrapperBounds.width - 110 ? 'right' : 'center',
      below: pointY < 56,
    })
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
    <div className="line-chart-wrap" ref={wrapperRef}>
      <svg ref={chartRef} className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
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
          className={`chart-tooltip ${activePoint.align} ${activePoint.below ? 'below' : ''}`}
          role="tooltip"
          style={{ left: `${activePoint.x}px`, top: `${activePoint.y}px` }}
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
            {activeIndex === index && (() => {
              const position = Math.max(2, (Number(value(item)) || 0) / maximum * 100)
              return <>
                <b className="bar-active-dot" style={{ left: `${position}%` }} />
                <span className={`bar-tooltip ${position > 80 ? 'right' : position < 20 ? 'left' : ''}`} role="tooltip" style={{ left: `${position}%` }}>{label(item)}: {display(item)}</span>
              </>
            })()}
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
  return (
    <div className="bundle-grid">
      {result.data.map(rule => (
        <article className="bundle-card" key={`${rule.item_a}-${rule.item_b}`}>
          <h3>{rule.item_a} <span>+</span> {rule.item_b}</h3>
          <p className="bundle-sentence">Sering terjual bersamaan. Cocok dijadikan paket.</p>
          <div className="bundle-stats">
            <span><strong>{(rule.support * 100).toFixed(1)}%</strong><span className="bundle-stat-label">Muncul bersama <small>(support)</small></span></span>
            <span><strong>{(rule.confidence * 100).toFixed(1)}%</strong><span className="bundle-stat-label">Jika beli A, ikut beli B <small>(confidence)</small></span></span>
            <span><strong>{Number(rule.lift).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x</strong><span className="bundle-stat-label">Kekuatan <small>(lift)</small></span></span>
          </div>
        </article>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [source, setSource] = useState('historis')
  const [range, setRange] = useState('30')
  const [basis, setBasis] = useState('day')
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [historicalSummary, setHistoricalSummary] = useState(null)
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
    api.dashboardSummary({ source: 'historis', range: 'semua' }).then(result => {
      if (current) setHistoricalSummary(result.data)
    }).catch(apiError => {
      if (current) notifyApiError(apiError, showToast)
    })
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
    : 'Rp—'
  const hasLowR2 = metric.r2 !== null && metric.r2 !== undefined && Number.isFinite(Number(metric.r2)) && Number(metric.r2) < 0.3
  const hasR2 = metric.r2 !== null && metric.r2 !== undefined && Number.isFinite(Number(metric.r2))
  const r2Value = hasR2 ? Number(metric.r2) : null
  const predictedRevenue = forecast?.forecast?.reduce((total, row) => total + (Number(row.omzet) || 0), 0) || 0
  const predictedDays = forecast?.forecast?.length || 0
  const predictedDailyAverage = predictedDays ? predictedRevenue / predictedDays : 0
  const historicalPcs = Number(historicalSummary?.total_pcs)
  const historicalRevenue = Number(historicalSummary?.total_omzet)
  const historicalAveragePrice = historicalPcs > 0 && Number.isFinite(historicalRevenue) ? historicalRevenue / historicalPcs : null
  const estimatedDailyPcs = historicalAveragePrice > 0 ? Math.round((predictedDailyAverage / historicalAveragePrice) / 10) * 10 : null
  const productCounts = (classification?.products || []).reduce((counts, product) => {
    const status = String(product.prediksi_minggu_depan || '').toLowerCase()
    if (status === 'laris' || status === 'kurang laris' || status === 'tidak laris') counts[status] += 1
    else if (status === 'data belum cukup') counts.insufficient += 1
    return counts
  }, { 'laris': 0, 'kurang laris': 0, 'tidak laris': 0, insufficient: 0 })
  const firstBundle = activeBundling?.data?.[0]
  const larisNames = (classification?.products || []).filter(product => String(product.prediksi_minggu_depan || '').toLowerCase() === 'laris').slice(0, 3).map(product => product.variant_name)
  const tidakLarisNames = (classification?.products || []).filter(product => String(product.prediksi_minggu_depan || '').toLowerCase() === 'tidak laris').slice(0, 3).map(product => product.variant_name)
  const accuracyTest = Number(classificationMetrics.accuracy_test)
  const bundlingRuleCount = Number(activeBundling?.rule_count ?? activeBundling?.data?.length ?? 0)
  const summaryHasData = Number(summary?.jumlah_transaksi) > 0
  const busiestDay = busyDays[0]?.hari
  const busiestHour = busyHours.data?.[0]?.jam
  const summaryConclusion = !summaryHasData
    ? 'Belum ada data untuk disimpulkan.'
    : `Pada ${sourceLabels[source]}, ${rangeLabels[range]}, omzet usahamu ${rupiah(summary.total_omzet)} dari ${integer(summary.jumlah_transaksi)} transaksi. Produk paling laku: ${topProducts[0]?.variant_name || 'belum dapat ditentukan'} (${integer(topProducts[0]?.total_pcs)} pcs); hari paling ramai: ${busiestDay || 'belum dapat ditentukan'}.${busiestHour !== undefined && busiestHour !== null ? ` Jam paling ramai sekitar ${String(busiestHour).padStart(2, '0')}.00.` : ''}`
  const predictionConclusion = predictedDays === 0
    ? 'Belum ada data untuk disimpulkan.'
    : `Perkiraan omzet 7 hari ke depan sekitar ${rupiah(predictedRevenue)}, rata-rata ${rupiah(Math.round(predictedDailyAverage))} per hari.${estimatedDailyPcs !== null ? ` Dengan harga rata-rata sekitar ${rupiah(historicalAveragePrice)} per pcs, itu setara kira-kira ${integer(estimatedDailyPcs)} pcs per hari.` : ''}${hasLowR2 ? ' Karena omzet harian naik-turun, anggap ini gambaran kasar, bukan kepastian.' : ''}`
  const productConclusion = !(classification?.products?.length)
    ? 'Belum ada data untuk disimpulkan.'
    : [
      [
        productCounts.laris > 0 ? `${integer(productCounts.laris)} produk diperkirakan laris minggu depan: ${larisNames.join(', ')}` : '',
        productCounts['tidak laris'] > 0 ? `${integer(productCounts['tidak laris'])} produk diperkirakan tidak laris: ${tidakLarisNames.join(', ')}` : '',
      ].filter(Boolean).join('; ') + (productCounts.laris > 0 || productCounts['tidak laris'] > 0 ? '.' : ''),
      productCounts.insufficient > 0 ? `${integer(productCounts.insufficient)} produk datanya belum cukup untuk dinilai.` : '',
      classificationMetrics.accuracy_test !== null && classificationMetrics.accuracy_test !== undefined && Number.isFinite(accuracyTest) ? `Akurasi model sekitar ${(accuracyTest * 100).toFixed(1)}%, jadi pakai sebagai pegangan, bukan kepastian.` : '',
    ].filter(Boolean).join(' ') || 'Belum ada data untuk disimpulkan.'
  const bundlingConclusion = firstBundle
    ? `Paket yang disarankan: ${firstBundle.item_a} + ${firstBundle.item_b}. Pasangan ini muncul bersama pada ${(Number(firstBundle.support) * 100).toFixed(1)}% ${basis === 'day' ? 'hari' : 'transaksi'} dan ${Number(firstBundle.lift).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x lebih sering bersama dibanding kebetulan, yang terkuat dari ${integer(bundlingRuleCount)} pasangan yang ditemukan. Jika beli ${firstBundle.item_a}, ${(Number(firstBundle.confidence) * 100).toFixed(1)}% ikut membeli ${firstBundle.item_b}.`
    : 'Belum ditemukan pola yang cukup kuat untuk dijadikan paket pada dasar perhitungan ini.'

  return (
    <section className="dashboard-page">
      <header className="page-header dashboard-header">
        <div><p className="eyebrow">Analitik usaha</p><h1>Dashboard</h1></div>
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
      <p className="dashboard-filter-note">Filter berlaku untuk Ringkasan; model memakai historis. Bundling memakai cara pengelompokan yang dipilih.</p>

      <div className="dashboard-tabs" role="tablist" aria-label="Bagian dashboard">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}
      </div>
      <TabHelp key={activeTab}>{tabHelp[activeTab]}</TabHelp>

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
              <Panel title="Tren omzet" className="chart-panel">
                {trend.length ? <LineChart labels={trend.map(row => row.period)} series={[{ name: 'Omzet', color: 'var(--forest-2)', values: trend.map(row => Number(row.omzet)) }]} ariaLabel="Grafik tren omzet" /> : <EmptyState title="Belum ada transaksi pada filter ini." />}
              </Panel>
              <div className="dashboard-two-column">
                <Panel title="Produk terlaris">
                  <TopProductsTable products={topProducts} />
                </Panel>
                <Panel title="Hari tersibuk" description="Rata-rata omzet per hari.">
                  <BarList items={busyDays} label={item => item.hari} value={item => item.rata_rata_omzet} display={item => rupiah(item.rata_rata_omzet)} />
                </Panel>
                <Panel title="Jam transaksi">
                  {busyHours.data?.length ? <BarList items={busyHours.data} label={item => `${String(item.jam).padStart(2, '0')}.00`} value={item => item.jumlah_transaksi} display={item => `${integer(item.jumlah_transaksi)} transaksi`} /> : <EmptyState title={busyHours.message || 'Belum ada data jam transaksi.'} />}
                </Panel>
              </div>
              <Conclusion>{summaryConclusion}</Conclusion>
            </div>}

            {activeTab === 'prediksi' && <div className="dashboard-content">
              {predictedDays > 0 && <MetricCard label="Perkiraan omzet 7 hari ke depan" value={rupiah(predictedRevenue)} note={`Rata-rata ${rupiah(Math.round(predictedRevenue / predictedDays))} per hari`} />}
              <Panel title="Omzet aktual dan prediksi 7 hari" className="chart-panel">
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
                <MetricCard label="Biasanya Meleset (MAE)" value={rupiah(metric.mae)} note={`Perkiraan omzet harian biasanya meleset sekitar ${maeInThousands} dari kenyataan. Makin kecil makin baik.`} />
                <MetricCard label="Meleset Jauh (RMSE)" value={rupiah(metric.rmse)} note="Seperti di atas, tapi lebih peka pada hari yang meleset jauh. Makin kecil makin baik." />
                <MetricCard label="Keandalan Perkiraan (R²)" value={hasR2 ? r2Value.toFixed(3) : '—'} badge={hasR2 ? r2Value < 0.3 ? 'Rendah' : r2Value <= 0.6 ? 'Sedang' : 'Baik' : null} note="Seberapa mengikuti pola penjualan asli (skala 0-1). Dekat 0 berarti perkiraan masih kasar." />
              </div>
              <p className="model-note"><TrendingUp size={16} /> Prediksi dimulai setelah data historis terakhir ({metric.last_historical_date || 'tanggal belum tersedia'}). Angka ini perkiraan, bukan jaminan penjualan.</p>
              {hasLowR2 && <p className="model-note model-warning">Omzet harian naik-turun tak menentu, jadi perkiraan hanya gambaran kasar.</p>}
              <Conclusion>{predictionConclusion}</Conclusion>
            </div>}

            {activeTab === 'produk' && <div className="dashboard-content">
              <article className="product-highlight metric-card">
                <span>Prediksi produk minggu depan</span>
                <div className="product-highlight-counts">
                  {['laris', 'kurang laris', 'tidak laris'].map(status => <span key={status}><strong>{integer(productCounts[status])}</strong>{status}</span>)}
                </div>
                {productCounts.insufficient > 0 && <small>{integer(productCounts.insufficient)} produk: Data belum cukup</small>}
              </article>
              <Panel title="Klasifikasi produk" description="Klasifikasi terakhir dan perkiraan minggu depan.">
                <ClassificationTable products={classification?.products || []} />
              </Panel>
              <div className="dashboard-two-column product-insights">
                <Panel title="Ringkasan akurasi">
                  <div className="classification-summary">
                    <strong>{Number.isFinite(Number(classificationMetrics.accuracy_test)) ? `${(Number(classificationMetrics.accuracy_test) * 100).toFixed(1)}%` : '—'}</strong>
                    <span>Akurasi uji · {integer(classificationMetrics.testing_rows)} data</span>
                    <p>{integer(excludedCount)} varian dikecualikan karena data kurang dari 4 minggu dan ditampilkan sebagai “Data belum cukup”.</p>
                  </div>
                </Panel>
                <Panel title="Confusion matrix" description="Diagonal = prediksi yang tepat.">
                  <ConfusionMatrix matrix={classificationMetrics.confusion_matrix} />
                </Panel>
              </div>
              <Conclusion>{productConclusion}</Conclusion>
            </div>}

            {activeTab === 'bundling' && <div className="dashboard-content">
              <article className="metric-card bundle-highlight">
                <span>Paket paling kuat</span>
                <strong>{firstBundle ? `${firstBundle.item_a} + ${firstBundle.item_b}` : 'Belum ada rekomendasi'}</strong>
              </article>
              <div className="bundling-controls">
                <div><h2>Cara mengelompokkan pembelian:</h2></div>
                <div className="segmented-control" role="group" aria-label="Cara pengelompokan pembelian">
                  <button type="button" className={basis === 'day' ? 'active' : ''} aria-pressed={basis === 'day'} onClick={() => setBasis('day')}>Per hari</button>
                  <button type="button" className={basis === 'transaction' ? 'active' : ''} aria-pressed={basis === 'transaction'} onClick={() => setBasis('transaction')}>Per transaksi</button>
                </div>
              </div>
              <div className="bundle-count-grid">
                <article className={basis === 'day' ? 'selected' : ''}><span>Jumlah pasangan per hari</span><strong>{integer(bundlings?.day?.rule_count ?? bundlings?.day?.data?.length)}</strong></article>
                <article className={basis === 'transaction' ? 'selected' : ''}><span>Jumlah pasangan per transaksi</span><strong>{integer(bundlings?.transaction?.rule_count ?? bundlings?.transaction?.data?.length)}</strong></article>
              </div>
              <Panel title="Rekomendasi Paket">
                <BundlingCards result={activeBundling} />
              </Panel>
              <Conclusion>{bundlingConclusion}</Conclusion>
            </div>}
          </>}
    </section>
  )
}
