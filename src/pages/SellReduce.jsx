import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, StopCircle, Trash2 } from 'lucide-react'
import { getStoredDemoItems, saveStoredDemoItems, itemProductName, addStoredDemoSale } from '../lib/catalog.js'
import toast from 'react-hot-toast'

export default function SellReduce() {
  const { isDemo } = useAuth()
  const [serial, setSerial] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [scanning, setScanning] = useState(false)
  const [removedItems, setRemovedItems] = useState([])
  const html5QrRef = useRef(null)
  const scanLockRef = useRef(false)

  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}) }
  }, [])

  async function startScan() {
    setScanning(true)
    scanLockRef.current = false
    html5QrRef.current = new Html5Qrcode('sell-reduce-reader')
    try {
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (scanLockRef.current) return
          scanLockRef.current = true
          if (!salePrice) {
            toast.error('Enter sale price before scanning')
            scanLockRef.current = false
            return
          }
          await reduceBySerial(decodedText)
          setTimeout(() => { scanLockRef.current = false }, 1200)
        },
        () => {}
      )
    } catch {
      toast.error('Camera access denied or not available')
      setScanning(false)
    }
  }

  async function stopScan() {
    if (html5QrRef.current) await html5QrRef.current.stop().catch(() => {})
    html5QrRef.current = null
    setScanning(false)
  }

  async function reduceBySerial(rawSerial) {
    const serialUpper = rawSerial.trim().toUpperCase()
    if (!serialUpper) return

    if (isDemo) {
      const currentItems = getStoredDemoItems()
      const item = currentItems.find(i => i.serial_number === serialUpper)
      if (!item) { toast.error('Serial number not found'); setSerial(''); return }
      const nextItems = currentItems.filter(i => i.serial_number !== serialUpper)
      saveStoredDemoItems(nextItems)
      addStoredDemoSale(item, { sale_price: salePrice ? parseFloat(salePrice) : item.purchase_price ?? 0 })
      setRemovedItems(current => [{ ...item, removed_at: new Date().toISOString() }, ...current])
      toast.success(`Removed ${serialUpper}`)
      setSerial('')
      setSalePrice('')
      return
    }

    const { data: item, error: findError } = await supabase
      .from('inventory_items')
      .select('id, serial_number, product_name, weight_grams, purchase_price, product_types(name)')
      .eq('serial_number', serialUpper)
      .eq('status', 'available')
      .single()
    if (findError || !item) { toast.error('Serial number not found'); setSerial(''); return }

    const { error: saleError } = await supabase.from('sales').insert({
      inventory_item_id: item.id,
      sale_price: salePrice ? parseFloat(salePrice) : item.purchase_price ?? 0,
      sold_at: new Date().toISOString()
    })
    if (saleError) { toast.error(saleError.message); return }

    const { error } = await supabase
      .from('inventory_items')
      .update({ status: 'sold' })
      .eq('id', item.id)
    if (error) { toast.error(error.message); return }

    setRemovedItems(current => [{ ...item, removed_at: new Date().toISOString() }, ...current])
    toast.success(`Removed ${serialUpper}`)
    setSerial('')
    setSalePrice('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await reduceBySerial(serial)
  }

  return (
    <div className="p-8 fade-up max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Sell / Reduce</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Remove sold or reduced items by QR scan or serial number</p>
      </div>

      <div className="card p-6 mb-6">
        <div id="sell-reduce-reader" className={`rounded-lg overflow-hidden mb-4 ${!scanning ? 'hidden' : ''}`} />
        {!scanning ? (
          <button onClick={startScan} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
            <QrCode size={16} /> Scan QR and Remove
          </button>
        ) : (
          <button onClick={stopScan} className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <StopCircle size={16} /> Stop Scanning
          </button>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="text-xs text-[#6b5a42] uppercase tracking-wider mb-3">Or enter serial number</h3>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input className="input flex-1" placeholder="e.g. ANK-0001" value={serial} onChange={e => setSerial(e.target.value)} />
          <input className="input w-36" type="number" step="0.01" placeholder="Sale price" value={salePrice} onChange={e => setSalePrice(e.target.value)} />
          <button type="submit" className="btn-gold px-4 flex items-center gap-2">
            <Trash2 size={14} /> Remove
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2012]">
          <h2 className="font-display text-base text-[#f5ead8]">Removed Items</h2>
        </div>
        {removedItems.length === 0 ? (
          <div className="p-5 text-[#4a3c2a] text-sm">No items removed in this session</div>
        ) : (
          <div className="divide-y divide-[#1a1208]">
            {removedItems.map(item => (
              <div key={`${item.serial_number}-${item.removed_at}`} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-mono text-red-400 text-xs">{item.serial_number}</span>
                <span className="text-[#8a7560]">{itemProductName(item)}</span>
                <span className="text-[#4a3c2a] text-xs">{new Date(item.removed_at).toLocaleTimeString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
