import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, CalendarDays, CalendarRange, Package } from 'lucide-react'
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

  const today = new Date().toDateString()
  const thisMonth = new Date().toISOString().slice(0, 7)
  const daySales = sales.filter(s => new Date(s.sold_at).toDateString() === today)
  const monthSales = sales.filter(s => new Date(s.sold_at).toISOString().slice(0, 7) === thisMonth)
  const productRows = summarizeByProduct(sales)

  const summaryCards = [
    { label: 'Today Sales', value: daySales.length, amount: sumSales(daySales), icon: CalendarDays },
    { label: 'Month Sales', value: monthSales.length, amount: sumSales(monthSales), icon: CalendarRange },
    { label: 'Product Groups', value: productRows.length, amount: sumSales(sales), icon: Package },
  ]

  return (
    <div className="p-8 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Sales</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Day, month and product-wise sales history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {summaryCards.map(({ label, value, amount, icon: Icon }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[#4a3c2a] text-xs uppercase tracking-wider">{label}</span>
              <Icon size={16} className="text-gold-400" />
            </div>
            <div className="font-display text-2xl text-[#f5ead8]">{value}</div>
            <div className="text-gold-400 text-sm mt-1">Rs. {amount.toLocaleString('en-IN')}</div>
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
              <div key={row.product} className="grid grid-cols-3 gap-3 py-2 px-3 bg-[#1e170d] rounded-lg text-sm">
                <span className="text-[#f5ead8]">{row.product}</span>
                <span className="text-[#8a7560]">{row.count} sold</span>
                <span className="text-gold-400 text-right">Rs. {row.amount.toLocaleString('en-IN')}</span>
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
        <table className="w-full text-sm">
          <thead className="border-b border-[#2a2012]">
            <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Serial</th>
              <th className="text-left px-5 py-3">Product</th>
              <th className="text-left px-5 py-3">Weight</th>
              <th className="text-left px-5 py-3">Sale Price</th>
              <th className="text-left px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1208]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-4 shimmer rounded" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[#4a3c2a]">No sales yet</td></tr>
            ) : filtered.map(sale => (
              <tr key={sale.id} className="hover:bg-[#1e170d]/40 transition-colors">
                <td className="px-5 py-3 font-mono text-gold-400 text-xs">{sale.inventory_items?.serial_number}</td>
                <td className="px-5 py-3 text-[#8a7560]">{itemProductName(sale.inventory_items ?? {})}</td>
                <td className="px-5 py-3 text-[#8a7560]">{sale.inventory_items?.weight_grams}g</td>
                <td className="px-5 py-3 text-[#f5ead8] font-medium">Rs. {Number(sale.sale_price).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-[#4a3c2a]">{new Date(sale.sold_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function sumSales(rows) {
  return rows.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0)
}

function summarizeByProduct(rows) {
  const grouped = new Map()
  rows.forEach(sale => {
    const product = itemProductName(sale.inventory_items ?? {})
    const current = grouped.get(product) ?? { product, count: 0, amount: 0 }
    current.count += 1
    current.amount += Number(sale.sale_price || 0)
    grouped.set(product, current)
  })
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount)
}
