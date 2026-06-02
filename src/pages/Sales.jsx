import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, CalendarDays, CalendarRange, Download, FileText, Package } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { getStoredDemoSales, itemProductName } from '../lib/catalog.js'

export default function Sales() {
  const { isDemo } = useAuth()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    if (isDemo) {
      setSales(getStoredDemoSales())
      setLoading(false)
      return
    }

    const { data } = await supabase.from('sales')
      .select('*, inventory_items(serial_number, product_name, weight_grams, product_types(name))')
      .order('sold_at', { ascending: false })
    setSales(data ?? [])
    setLoading(false)
  }

  const filtered = sales.filter(sale =>
    sale.inventory_items?.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
    itemProductName(sale.inventory_items ?? {}).toLowerCase().includes(search.toLowerCase()) ||
    sale.buyer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const today = dateKey(new Date())
  const thisMonth = monthKey(new Date())
  const daySales = sales.filter(s => dateKey(s.sold_at) === today)
  const monthSales = sales.filter(s => monthKey(s.sold_at) === thisMonth)
  const productRows = summarizeByProduct(sales)

  const summaryCards = [
    { label: 'Today Sales', value: daySales.length, amount: sumSales(daySales), profit: sumProfit(daySales), icon: CalendarDays },
    { label: 'Month Sales', value: monthSales.length, amount: sumSales(monthSales), profit: sumProfit(monthSales), icon: CalendarRange },
    { label: 'Product Groups', value: productRows.length, amount: sumSales(sales), profit: sumProfit(sales), icon: Package },
  ]

  return (
    <div className="p-8 fade-up">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-[#f5ead8]">Sales</h1>
          <p className="text-[#4a3c2a] text-sm mt-1">Day, month and product-wise sales history</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => downloadCsv(filtered)} className="btn-ghost flex items-center justify-center gap-2 px-4 py-2">
            <Download size={14} /> Download Excel
          </button>
          <button onClick={() => downloadPdf(filtered)} className="btn-gold flex items-center justify-center gap-2 px-4 py-2">
            <FileText size={14} /> Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {summaryCards.map(({ label, value, amount, profit, icon: Icon }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[#4a3c2a] text-xs uppercase tracking-wider">{label}</span>
              <Icon size={16} className="text-gold-400" />
            </div>
            <div className="font-display text-2xl text-[#f5ead8]">{value}</div>
            <div className="text-gold-400 text-sm mt-1">Rs. {amount.toLocaleString('en-IN')}</div>
            <div className={`text-xs mt-1 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Profit Rs. {profit.toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-display text-base text-[#f5ead8] mb-4">Product Wise Sales</h2>
        {productRows.length === 0 ? (
          <p className="text-[#4a3c2a] text-sm">No product sales yet.</p>
        ) : (
          <div className="space-y-2">
            {productRows.map(row => (
              <div key={row.product} className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-2 px-3 bg-[#1e170d] rounded-lg text-sm">
                <span className="text-[#f5ead8]">{row.product}</span>
                <span className="text-[#8a7560]">{row.count} sold</span>
                <span className="text-gold-400 lg:text-right">Rs. {row.amount.toLocaleString('en-IN')}</span>
                <span className={`${row.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} lg:text-right`}>
                  Profit Rs. {row.profit.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a3c2a]" />
        <input className="input pl-9" placeholder="Search by serial, product or buyer..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="border-b border-[#2a2012]">
              <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Serial</th>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">Weight</th>
                <th className="text-left px-5 py-3">Purchase</th>
                <th className="text-left px-5 py-3">Sold</th>
                <th className="text-left px-5 py-3">Profit</th>
                <th className="text-left px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1208]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-4 shimmer rounded" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-[#4a3c2a]">No sales yet</td></tr>
              ) : filtered.map(sale => (
                <tr key={sale.id} className="hover:bg-[#1e170d]/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-gold-400 text-xs">{sale.inventory_items?.serial_number}</td>
                  <td className="px-5 py-3 text-[#8a7560]">{itemProductName(sale.inventory_items ?? {})}</td>
                  <td className="px-5 py-3 text-[#8a7560]">{sale.inventory_items?.weight_grams}g</td>
                  <td className="px-5 py-3 text-[#8a7560]">Rs. {salePurchase(sale).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-[#f5ead8] font-medium">Rs. {Number(sale.sale_price || 0).toLocaleString('en-IN')}</td>
                  <td className={`px-5 py-3 font-medium ${saleProfit(sale) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Rs. {saleProfit(sale).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3 text-[#4a3c2a]">{new Date(sale.sold_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function dateKey(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthKey(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function salePurchase(sale) {
  return Number(sale.purchase_rate ?? sale.inventory_items?.purchase_price ?? 0)
}

function saleProfit(sale) {
  return Number(sale.profit ?? Number(sale.sale_price || 0) - salePurchase(sale))
}

function sumSales(rows) {
  return rows.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0)
}

function sumProfit(rows) {
  return rows.reduce((sum, sale) => sum + saleProfit(sale), 0)
}

function summarizeByProduct(rows) {
  const grouped = new Map()
  rows.forEach(sale => {
    const product = itemProductName(sale.inventory_items ?? {})
    const current = grouped.get(product) ?? { product, count: 0, amount: 0, profit: 0 }
    current.count += 1
    current.amount += Number(sale.sale_price || 0)
    current.profit += saleProfit(sale)
    grouped.set(product, current)
  })
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount)
}

function exportRows(rows) {
  return rows.map(sale => ({
    Serial: sale.inventory_items?.serial_number ?? '',
    Product: itemProductName(sale.inventory_items ?? {}),
    Weight: `${sale.inventory_items?.weight_grams ?? ''}g`,
    PurchaseRate: salePurchase(sale),
    SoldRate: Number(sale.sale_price || 0),
    Profit: saleProfit(sale),
    Date: new Date(sale.sold_at).toLocaleString('en-IN'),
  }))
}

function downloadCsv(rows) {
  const data = exportRows(rows)
  const headers = Object.keys(data[0] ?? {
    Serial: '', Product: '', Weight: '', PurchaseRate: '', SoldRate: '', Profit: '', Date: ''
  })
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `sales-history-${dateKey(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function downloadPdf(rows) {
  const data = exportRows(rows)
  const htmlRows = data.map(row => `
    <tr>
      <td>${escapeHtml(row.Serial)}</td>
      <td>${escapeHtml(row.Product)}</td>
      <td>${escapeHtml(row.Weight)}</td>
      <td>Rs. ${Number(row.PurchaseRate).toLocaleString('en-IN')}</td>
      <td>Rs. ${Number(row.SoldRate).toLocaleString('en-IN')}</td>
      <td>Rs. ${Number(row.Profit).toLocaleString('en-IN')}</td>
      <td>${escapeHtml(row.Date)}</td>
    </tr>
  `).join('')
  const win = window.open('', '_blank', 'width=1100,height=800')
  if (!win) return
  win.document.write(`
    <html>
      <head>
        <title>Sales History</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 0 0 20px; color: #555; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f3f3f3; }
        </style>
      </head>
      <body>
        <h1>Sales History</h1>
        <p>Generated ${new Date().toLocaleString('en-IN')}</p>
        <table>
          <thead>
            <tr><th>Serial</th><th>Product</th><th>Weight</th><th>Purchase</th><th>Sold</th><th>Profit</th><th>Date</th></tr>
          </thead>
          <tbody>${htmlRows || '<tr><td colspan="7">No sales found</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
