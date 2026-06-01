import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Boxes, Layers, Package } from 'lucide-react'
import { getStoredDemoItems, getStoredDemoTypes, getTypeFields, itemFieldValue, itemProductName } from '../lib/catalog.js'

export default function StockView() {
  const { isDemo } = useAuth()
  const [items, setItems] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')

  useEffect(() => { fetchStock() }, [])

  async function fetchStock() {
    if (isDemo) {
      setItems(getStoredDemoItems())
      setTypes(getStoredDemoTypes())
      setLoading(false)
      return
    }

    const [{ data: itemData }, { data: typeData }] = await Promise.all([
      supabase.from('inventory_items')
        .select('id, serial_number, product_type_id, product_name, weight_grams, purchase_price, field_values, status, product_types(name, fields)')
        .eq('status', 'available')
        .order('serial_number'),
      supabase.from('product_types').select('*').order('name'),
    ])
    setItems(itemData ?? [])
    setTypes(typeData ?? [])
    setLoading(false)
  }

  const categoryRows = summarize(items, item => item.product_types?.name ?? 'Uncategorized')
  const productRows = summarize(items, itemProductName)
  const products = Array.from(new Set(items.map(itemProductName))).filter(Boolean).sort()
  const filteredItems = items.filter(item => {
    const categoryMatch = categoryFilter === 'all' || item.product_type_id === categoryFilter || item.product_types?.name === categoryFilter
    const productMatch = productFilter === 'all' || itemProductName(item) === productFilter
    return categoryMatch && productMatch
  })
  const selectedCategory = types.find(type => type.id === categoryFilter || type.name === categoryFilter)
  const selectedItemType = selectedCategory ?? types.find(type => type.id === filteredItems[0]?.product_type_id || type.name === filteredItems[0]?.product_types?.name)
  const dynamicFields = getTypeFields(selectedItemType).filter(field => field.id !== 'weight_grams')
  const totalWeight = filteredItems.reduce((sum, item) => sum + Number(item.weight_grams || 0), 0)

  return (
    <div className="p-8 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Stock View</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Category, product and item stock with counts and weights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Summary label="Categories" value={types.length} icon={Layers} />
        <Summary label="Items" value={filteredItems.length} icon={Package} />
        <Summary label="Total Weight" value={`${totalWeight.toFixed(2)}g`} icon={Boxes} />
      </div>

      <div className="card p-5 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Category</label>
            <select className="input" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setProductFilter('all') }}>
              <option value="all">All categories</option>
              {types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Product</label>
            <select className="input" value={productFilter} onChange={e => setProductFilter(e.target.value)}>
              <option value="all">All products</option>
              {products
                .filter(product => categoryFilter === 'all' || items.some(item => itemProductName(item) === product && (item.product_type_id === categoryFilter || item.product_types?.name === categoryFilter)))
                .map(product => <option key={product} value={product}>{product}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <SummaryTable title="Categories List" rows={categoryRows} />
        <SummaryTable title="Products List" rows={productRows} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2012]">
          <h2 className="font-display text-base text-[#f5ead8]">Items List</h2>
        </div>
        {loading ? (
          <div className="p-5 text-[#4a3c2a] text-sm">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-5 text-[#4a3c2a] text-sm">No stock available</div>
        ) : (
          <table className="w-full text-sm min-w-max">
            <thead className="border-b border-[#2a2012]">
              <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Serial</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-left px-5 py-3">Weight</th>
                {dynamicFields.map(field => (
                  <th key={field.id} className="text-left px-5 py-3">{field.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1208]">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-[#1e170d]/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-gold-400 text-xs">{item.serial_number}</td>
                  <td className="px-5 py-3 text-[#8a7560]">{item.product_types?.name}</td>
                  <td className="px-5 py-3 text-[#f5ead8]">{itemProductName(item)}</td>
                  <td className="px-5 py-3 text-[#8a7560]">{Number(item.weight_grams || 0).toFixed(2)}g</td>
                  {dynamicFields.map(field => (
                    <td key={field.id} className="px-5 py-3 text-[#8a7560]">{itemFieldValue(item, field) || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Summary({ label, value, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[#4a3c2a] text-xs uppercase tracking-wider">{label}</span>
        <Icon size={16} className="text-gold-400" />
      </div>
      <div className="font-display text-2xl text-[#f5ead8]">{value}</div>
    </div>
  )
}

function SummaryTable({ title, rows }) {
  return (
    <div className="card p-6">
      <h2 className="font-display text-base text-[#f5ead8] mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[#4a3c2a] text-sm">No data</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.name} className="grid grid-cols-3 gap-3 py-2 px-3 bg-[#1e170d] rounded-lg text-sm">
              <span className="text-[#f5ead8]">{row.name}</span>
              <span className="text-[#8a7560]">{row.count} items</span>
              <span className="text-gold-400 text-right">{row.weight.toFixed(2)}g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function summarize(items, getName) {
  const grouped = new Map()
  items.forEach(item => {
    const name = getName(item)
    const current = grouped.get(name) ?? { name, count: 0, weight: 0 }
    current.count += 1
    current.weight += Number(item.weight_grams || 0)
    grouped.set(name, current)
  })
  return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name))
}
