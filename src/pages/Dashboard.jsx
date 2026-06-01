import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Package, ShoppingBag, AlertCircle, TrendingUp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { getStoredDemoItems, getStoredDemoSales, itemProductName } from '../lib/catalog.js'

export default function Dashboard() {
  const { isDemo } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    if (isDemo) {
      const items = getStoredDemoItems()
      const sales = getStoredDemoSales()
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthSales = sales.filter(sale => new Date(sale.sold_at) >= startOfMonth)
      const revenue = monthSales.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0)
      setStats({ totalItems: items.length + sales.length, available: items.length, sold: sales.length, revenue })
      setRecentSales(sales.slice(0, 5))
      setLoading(false)
      return
    }

    const [
      { count: totalItems },
      { count: available },
      { count: sold },
      { data: sales }
    ] = await Promise.all([
      supabase.from('inventory_items').select('*', { count: 'exact', head: true }),
      supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
      supabase.from('sales').select('*, inventory_items(serial_number, product_name, product_types(name))').order('sold_at', { ascending: false }).limit(5),
    ])

    // Revenue this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const { data: monthSales } = await supabase
      .from('sales')
      .select('sale_price')
      .gte('sold_at', startOfMonth.toISOString())

    const revenue = monthSales?.reduce((sum, s) => sum + Number(s.sale_price), 0) ?? 0

    setStats({ totalItems: totalItems ?? 0, available: available ?? 0, sold: sold ?? 0, revenue })
    setRecentSales(sales ?? [])
    setLoading(false)
  }

  const statCards = stats ? [
    { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'text-gold-400' },
    { label: 'Available', value: stats.available, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Sold', value: stats.sold, icon: ShoppingBag, color: 'text-blue-400' },
    { label: "Revenue (This Month)", value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: AlertCircle, color: 'text-gold-400' },
  ] : []

  return (
    <div className="p-8 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Dashboard</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Stock overview at a glance</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-24 shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[#4a3c2a] text-xs uppercase tracking-wider">{label}</span>
                <Icon size={16} className={color} />
              </div>
              <div className={`font-display text-2xl ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-display text-base text-[#f5ead8] mb-4">Recent Sales</h2>
        {recentSales.length === 0 ? (
          <p className="text-[#4a3c2a] text-sm">No sales yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider border-b border-[#2a2012]">
                <th className="text-left pb-3">Serial</th>
                <th className="text-left pb-3">Category</th>
                <th className="text-left pb-3">Price</th>
                <th className="text-left pb-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e170d]">
              {recentSales.map(sale => (
                <tr key={sale.id} className="hover:bg-[#1e170d]/50 transition-colors">
                  <td className="py-3 font-mono text-gold-400 text-xs">{sale.inventory_items?.serial_number ?? '—'}</td>
                  <td className="py-3 text-[#8a7560]">{itemProductName(sale.inventory_items ?? {})}</td>
                  <td className="py-3 text-[#f5ead8]">₹{Number(sale.sale_price).toLocaleString('en-IN')}</td>
                  <td className="py-3 text-[#4a3c2a]">{new Date(sale.sold_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
