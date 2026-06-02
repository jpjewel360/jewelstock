import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Html5Qrcode } from 'html5-qrcode'
import { CheckCircle2, QrCode, Search, StopCircle, Trash2 } from 'lucide-react'
import { getStoredDemoItems, saveStoredDemoItems, itemProductName, addStoredDemoSale } from '../lib/catalog.js'
import toast from 'react-hot-toast'

export default function SellReduce() {
  const { isDemo, user } = useAuth()
  const [serial, setSerial] = useState('')
  const [purchaseRate, setPurchaseRate] = useState('')
  const [soldRate, setSoldRate] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [removedItems, setRemovedItems] = useState([])
  const html5QrRef = useRef(null)
  const scanLockRef = useRef(false)

  const profit = useMemo(() => {
    const purchase = Number(purchaseRate || 0)
    const sold = Number(soldRate || 0)
    return sold - purchase
  }, [purchaseRate, soldRate])

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
          await findItem(decodedText)
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

  function prepareItem(item) {
    setSelectedItem(item)
    setSerial(item.serial_number)
    const defaultPurchase = item.purchase_price ?? item.purchase_rate ?? 0
    setPurchaseRate(defaultPurchase ? String(defaultPurchase) : '')
    setSoldRate('')
  }

  async function findItem(rawSerial) {
    const serialUpper = rawSerial.trim().toUpperCase()
    if (!serialUpper) return

    if (isDemo) {
      const item = getStoredDemoItems().find(i => i.serial_number === serialUpper)
      if (!item) { toast.error('Serial number not found'); return }
      prepareItem(item)
      toast.success(`Found ${serialUpper}`)
      return
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .select('id, serial_number, product_name, weight_grams, purchase_price, field_values, product_types(name)')
      .eq('serial_number', serialUpper)
      .eq('status', 'available')
      .single()

    if (error || !item) {
      toast.error('Serial number not found or already sold')
      return
    }
    prepareItem(item)
    toast.success(`Found ${serialUpper}`)
  }

  async function confirmSale() {
    if (!selectedItem) return
    if (!soldRate) { toast.error('Enter sold rate'); return }

    const purchase = Number(purchaseRate || 0)
    const sold = Number(soldRate || 0)
    if (!Number.isFinite(sold) || sold < 0) { toast.error('Enter valid sold rate'); return }
    if (!Number.isFinite(purchase) || purchase < 0) { toast.error('Enter valid purchase rate'); return }

    if (isDemo) {
      const currentItems = getStoredDemoItems()
      saveStoredDemoItems(currentItems.filter(i => i.serial_number !== selectedItem.serial_number))
      addStoredDemoSale(selectedItem, { purchase_rate: purchase, sale_price: sold, profit: sold - purchase })
      finishSale(selectedItem)
      return
    }

    const { error: saleError } = await supabase.from('sales').insert({
      inventory_item_id: selectedItem.id,
      purchase_rate: purchase,
      sale_price: sold,
      profit: sold - purchase,
      sold_by: user?.id,
      sold_at: new Date().toISOString()
    })
    if (saleError) { toast.error(saleError.message); return }

    const { error } = await supabase
      .from('inventory_items')
      .update({ status: 'sold' })
      .eq('id', selectedItem.id)
    if (error) { toast.error(error.message); return }

    finishSale(selectedItem)
  }

  function finishSale(item) {
    setRemovedItems(current => [{ ...item, removed_at: new Date().toISOString(), sale_price: Number(soldRate || 0) }, ...current])
    toast.success(`Removed ${item.serial_number}`)
    setSelectedItem(null)
    setSerial('')
    setPurchaseRate('')
    setSoldRate('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await findItem(serial)
  }

  return (
    <div className="p-8 fade-up max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Sell / Reduce</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Find an item by QR scan or serial number, then confirm sale and profit</p>
      </div>

      <div className="card p-6 mb-6">
        <div id="sell-reduce-reader" className={`rounded-lg overflow-hidden mb-4 ${!scanning ? 'hidden' : ''}`} />
        {!scanning ? (
          <button onClick={startScan} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
            <QrCode size={16} /> Scan QR Code
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
          <input className="input flex-1" placeholder="e.g. RIN-0001" value={serial} onChange={e => setSerial(e.target.value)} />
          <button type="submit" className="btn-gold px-4 flex items-center gap-2">
            <Search size={14} /> Find
          </button>
        </form>
      </div>

      {selectedItem && (
        <div className="card p-6 mb-6 border-gold-700/60">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs text-[#6b5a42] uppercase tracking-wider mb-1">Confirm item</p>
              <h2 className="font-display text-xl text-[#f5ead8]">{itemProductName(selectedItem)}</h2>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <span className="font-mono text-gold-400">{selectedItem.serial_number}</span>
                <span className="text-[#8a7560]">{selectedItem.weight_grams ?? 0}g</span>
                <span className="text-[#8a7560]">{selectedItem.product_types?.name}</span>
              </div>
            </div>
            <CheckCircle2 className="text-emerald-400 shrink-0" size={22} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <label className="block">
              <span className="text-xs text-[#6b5a42] uppercase tracking-wider">Purchase Rate</span>
              <input className="input mt-2" type="number" step="0.01" value={purchaseRate} onChange={e => setPurchaseRate(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-[#6b5a42] uppercase tracking-wider">Sold Rate</span>
              <input className="input mt-2" type="number" step="0.01" value={soldRate} onChange={e => setSoldRate(e.target.value)} />
            </label>
            <div className="rounded-lg border border-[#2a2012] bg-[#1e170d] p-4">
              <span className="text-xs text-[#6b5a42] uppercase tracking-wider">Profit</span>
              <div className={`font-display text-xl mt-2 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Rs. {profit.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={confirmSale} className="btn-gold flex-1 flex items-center justify-center gap-2 py-3">
              <Trash2 size={15} /> Confirm Sell / Reduce
            </button>
            <button onClick={() => setSelectedItem(null)} className="btn-ghost px-5 py-3">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2012]">
          <h2 className="font-display text-base text-[#f5ead8]">Removed Items</h2>
        </div>
        {removedItems.length === 0 ? (
          <div className="p-5 text-[#4a3c2a] text-sm">No items removed in this session</div>
        ) : (
          <div className="divide-y divide-[#1a1208]">
            {removedItems.map(item => (
              <div key={`${item.serial_number}-${item.removed_at}`} className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 text-sm">
                <span className="font-mono text-red-400 text-xs">{item.serial_number}</span>
                <span className="text-[#8a7560]">{itemProductName(item)}</span>
                <span className="text-[#f5ead8]">Rs. {Number(item.sale_price || 0).toLocaleString('en-IN')}</span>
                <span className="text-[#4a3c2a] text-xs sm:text-right">{new Date(item.removed_at).toLocaleTimeString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
