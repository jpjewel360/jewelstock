import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Plus, QrCode, Download, X, Search, Printer } from 'lucide-react'
import { getStoredDemoItems, saveStoredDemoItems, getStoredDemoTypes, getTypeFields, getTypeProducts, itemProductName, nextSerialForProduct } from '../lib/catalog.js'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

export default function Inventory() {
  const { isDemo } = useAuth()
  const [items, setItems] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [qrItem, setQrItem] = useState(null)
  const [labelQrSrc, setLabelQrSrc] = useState('')
  const [showPriceOnLabel, setShowPriceOnLabel] = useState(false)
  const qrCanvasRef = useRef(null)

  const [form, setForm] = useState({ product_type_id: '', product_name: '', field_values: {}, notes: '' })
  const selectedType = types.find(t => t.id === form.product_type_id)
  const selectedFields = getTypeFields(selectedType)
  const selectedProducts = getTypeProducts(selectedType)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (qrItem && qrCanvasRef.current) generateQR() }, [qrItem])

  async function fetchAll() {
    if (isDemo) {
      setItems(getStoredDemoItems())
      setTypes(getStoredDemoTypes())
      setLoading(false)
      return
    }

    const [{ data: itemsData }, { data: typesData }] = await Promise.all([
      supabase.from('inventory_items')
        .select('*, product_types(name, fields, products)')
        .eq('status', 'available')
        .order('created_at', { ascending: false }),
      supabase.from('product_types').select('*').order('name')
    ])
    setItems(itemsData ?? [])
    setTypes(typesData ?? [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (isDemo) {
      const type = getStoredDemoTypes().find(t => t.id === form.product_type_id)
      const currentItems = getStoredDemoItems()
      const newItem = {
        id: `demo-${Date.now()}`,
        product_type_id: form.product_type_id,
        product_name: form.product_name,
        serial_number: nextSerialForProduct(currentItems, form.product_name),
        weight_grams: parseFloat(form.field_values.weight_grams || 0),
        purchase_price: form.field_values.purchase_price ? parseFloat(form.field_values.purchase_price) : null,
        field_values: form.field_values,
        notes: form.notes,
        status: 'available',
        product_types: { name: type?.name ?? 'Category', fields: getTypeFields(type), products: getTypeProducts(type) },
      }
      const nextItems = [newItem, ...currentItems]
      saveStoredDemoItems(nextItems)
      setItems(nextItems)
      toast.success(`Demo item added - Serial: ${newItem.serial_number}`)
      setShowAdd(false)
      setForm({ product_type_id: '', product_name: '', field_values: {}, notes: '' })
      return
    }

    // Get next serial
    const { data: serialData, error: serialErr } = await supabase
      .rpc('next_serial', { type_id: form.product_type_id, product_name_input: form.product_name })
    if (serialErr) { toast.error('Serial generation failed'); return }

    const { error } = await supabase.from('inventory_items').insert({
      product_type_id: form.product_type_id,
      product_name: form.product_name,
      serial_number: serialData,
      weight_grams: parseFloat(form.field_values.weight_grams || 0),
      purchase_price: form.field_values.purchase_price ? parseFloat(form.field_values.purchase_price) : null,
      field_values: form.field_values,
      notes: form.notes,
      status: 'available'
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Added — Serial: ${serialData}`)
    setShowAdd(false)
    setForm({ product_type_id: '', product_name: '', field_values: {}, notes: '' })
    fetchAll()
  }

  async function generateQR() {
    if (!qrCanvasRef.current || !qrItem) return
    const qrOptions = {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }
    await QRCode.toCanvas(qrCanvasRef.current, qrItem.serial_number, qrOptions)
    setLabelQrSrc(await QRCode.toDataURL(qrItem.serial_number, qrOptions))
  }

  async function downloadQR() {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${qrItem.serial_number}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  function printLabel() {
    const productName = itemProductName(qrItem)
    const serialNumber = qrItem.serial_number
    const weight = Number(qrItem.weight_grams).toFixed(2)
    const price = qrItem.purchase_price ? Number(qrItem.purchase_price).toLocaleString('en-IN') : ''
    const priceLine = showPriceOnLabel && price ? `<div><span>PRICE:</span> Rs. ${price}</div>` : ''
    const existingFrame = document.getElementById('label-print-frame')
    if (existingFrame) existingFrame.remove()
    const printFrame = document.createElement('iframe')
    printFrame.id = 'label-print-frame'
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    document.body.appendChild(printFrame)
    const printDocument = printFrame.contentWindow.document

    printDocument.open()
    printDocument.write(`
      <!doctype html>
      <html>
        <head>
          <title>${serialNumber} label</title>
          <style>
            @page { size: 65mm 15mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body {
              width: 65mm;
              height: 15mm;
              margin: 0;
              overflow: hidden;
              background: #fff;
            }
            .label {
              position: relative;
              width: 65mm;
              height: 15mm;
              overflow: hidden;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
            }
            .qr {
              position: absolute;
              left: 12mm;
              top: 1.6mm;
              width: 12mm;
              height: 12mm;
              object-fit: contain;
              image-rendering: pixelated;
            }
            .details {
              position: absolute;
              left: 35mm;
              top: 2mm;
              right: 2.5mm;
              display: grid;
              gap: 0.35mm;
              font-size: 6pt;
              font-weight: 800;
              line-height: 1.1;
              letter-spacing: 0;
            }
            .details span,
            .product { font-weight: 800; }
            .product {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: 6.8pt;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img class="qr" src="${labelQrSrc}" alt="">
            <div class="details">
              <div class="product">${productName}</div>
              <div><span>SN:</span> ${serialNumber}</div>
              <div><span>WT:</span> ${weight} g</div>
              ${priceLine}
            </div>
          </div>
          <script>
            window.onload = () => {
              window.focus();
              setTimeout(() => window.print(), 150);
            };
          </script>
        </body>
      </html>
    `)
    printDocument.close()
    printFrame.onload = () => {
      printFrame.contentWindow.focus()
      printFrame.contentWindow.print()
    }
  }

  const filtered = items.filter(i =>
    i.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.product_types?.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.product_name?.toLowerCase().includes(search.toLowerCase())
  )

  function updateField(fieldId, value) {
    setForm(f => ({ ...f, field_values: { ...f.field_values, [fieldId]: value } }))
  }

  return (
    <div className="p-8 fade-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-[#f5ead8]">Inventory</h1>
          <p className="text-[#4a3c2a] text-sm mt-1">{items.length} items total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold flex items-center gap-2">
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a3c2a]" />
        <input
          className="input pl-9"
          placeholder="Search by serial, category or product..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[#2a2012]">
            <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Serial</th>
              <th className="text-left px-5 py-3">Category</th>
              <th className="text-left px-5 py-3">Product</th>
              <th className="text-left px-5 py-3">Weight</th>
              <th className="text-left px-5 py-3">Purchase Price</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">QR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1208]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-4 shimmer rounded" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-[#4a3c2a]">No items found</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-[#1e170d]/40 transition-colors">
                <td className="px-5 py-3 font-mono text-gold-400 text-xs">{item.serial_number}</td>
                <td className="px-5 py-3 text-[#8a7560]">{item.product_types?.name}</td>
                <td className="px-5 py-3 text-[#f5ead8]">{itemProductName(item)}</td>
                <td className="px-5 py-3 text-[#f5ead8]">{item.weight_grams}g</td>
                <td className="px-5 py-3 text-[#f5ead8]">{item.purchase_price ? `Rs. ${Number(item.purchase_price).toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-5 py-3">
                  {item.status === 'available' && <span className="badge-available">available</span>}
                  {item.status === 'sold' && <span className="badge-sold">sold</span>}
                  {item.status === 'audit' && <span className="badge-audit">audit</span>}
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => setQrItem(item)} className="text-[#4a3c2a] hover:text-gold-400 transition-colors">
                    <QrCode size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md fade-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-[#f5ead8]">Add Inventory Item</h2>
              <button onClick={() => setShowAdd(false)} className="text-[#4a3c2a] hover:text-[#f5ead8]"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Category</label>
                <select className="input" value={form.product_type_id} onChange={e => setForm(f => ({ ...f, product_type_id: e.target.value, product_name: '', field_values: {} }))} required>
                  <option value="">Select category...</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {selectedType && (
                <div>
                  <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Product</label>
                  <select className="input" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} required>
                    <option value="">Select product...</option>
                    {selectedProducts.map(product => <option key={product} value={product}>{product}</option>)}
                  </select>
                </div>
              )}
              {selectedType && selectedFields.map(field => (
                <div key={field.id}>
                  <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">{field.label}</label>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.type === 'number' ? '0.01' : undefined}
                    className="input"
                    value={form.field_values[field.id] ?? ''}
                    onChange={e => updateField(field.id, e.target.value)}
                    placeholder={field.label}
                    required={field.required}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Notes (optional)</label>
                <input type="text" className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-gold flex-1">Add Item</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md fade-up text-center qr-print-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base text-[#f5ead8]">QR Label</h2>
              <button onClick={() => setQrItem(null)} className="text-[#4a3c2a] hover:text-[#f5ead8]"><X size={18} /></button>
            </div>
            <div className="mb-4 flex justify-center">
              <div className="qr-label-print" aria-label="65mm by 15mm Zebra label preview">
                {labelQrSrc && <img className="qr-label-print__qr" src={labelQrSrc} alt={`QR for ${qrItem.serial_number}`} />}
                <div className="qr-label-print__details">
                  <div className="qr-label-print__product">{itemProductName(qrItem)}</div>
                  <div><span>SN:</span> {qrItem.serial_number}</div>
                  <div><span>WT:</span> {Number(qrItem.weight_grams).toFixed(2)} g</div>
                  {showPriceOnLabel && qrItem.purchase_price && <div><span>PRICE:</span> Rs. {Number(qrItem.purchase_price).toLocaleString('en-IN')}</div>}
                </div>
              </div>
            </div>
            <canvas ref={qrCanvasRef} className="mx-auto rounded-lg mb-3 hidden" />
            <label className="flex items-center justify-center gap-2 text-[#8a7560] text-xs mb-4">
              <input
                type="checkbox"
                className="accent-gold-500"
                checked={showPriceOnLabel}
                onChange={e => setShowPriceOnLabel(e.target.checked)}
              />
              Show optional price on label
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadQR} className="btn-ghost flex items-center justify-center gap-2">
                <Download size={14} /> QR PNG
              </button>
              <button onClick={printLabel} className="btn-gold flex items-center justify-center gap-2">
                <Printer size={14} /> Print 65 x 15 mm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
