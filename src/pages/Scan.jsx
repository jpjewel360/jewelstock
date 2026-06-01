import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, CheckCircle, XCircle, StopCircle, Trash2, Search } from 'lucide-react'
import { getStoredDemoItems, itemProductName } from '../lib/catalog.js'
import toast from 'react-hot-toast'

export default function Scan() {
  const { isDemo } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [serial, setSerial] = useState('')
  const [lastNotFound, setLastNotFound] = useState('')
  const [scanHistory, setScanHistory] = useState([])
  const [missingItems, setMissingItems] = useState([])
  const [checkDone, setCheckDone] = useState(false)
  const [checkProduct, setCheckProduct] = useState('all')
  const [inventoryProducts, setInventoryProducts] = useState([])
  const html5QrRef = useRef(null)
  const scanLockRef = useRef(false)
  const scannedSerialsRef = useRef(new Set())

  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}) }
  }, [])
  useEffect(() => { fetchInventoryProducts() }, [])

  useEffect(() => {
    scannedSerialsRef.current = new Set(scanHistory.map(item => item.serial_number))
  }, [scanHistory])

  async function startScan() {
    setLastNotFound('')
    setScanning(true)
    scanLockRef.current = false
    html5QrRef.current = new Html5Qrcode('qr-reader')
    try {
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (scanLockRef.current) return
          scanLockRef.current = true
          await lookupSerial(decodedText)
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

  async function fetchInventoryProducts() {
    if (isDemo) {
      setInventoryProducts(Array.from(new Set(getStoredDemoItems().map(itemProductName))))
      return
    }
    const { data } = await supabase
      .from('inventory_items')
      .select('product_name, product_types(name)')
      .eq('status', 'available')
    setInventoryProducts(Array.from(new Set((data ?? []).map(itemProductName).filter(Boolean))))
  }

  async function lookupSerial(rawSerial) {
    const serialUpper = rawSerial.trim().toUpperCase()
    if (!serialUpper) return
    setLastNotFound('')
    setCheckDone(false)
    setMissingItems([])

    if (scannedSerialsRef.current.has(serialUpper)) {
      toast.error('Already scanned')
      setSerial('')
      return
    }

    if (isDemo) {
      const item = getStoredDemoItems().find(i => i.serial_number === serialUpper)
      if (!item) {
        setLastNotFound(serialUpper)
        toast.error('Serial number not found in inventory')
        setSerial('')
        return
      }
      addScannedItem(item)
      return
    }

    const { data } = await supabase
      .from('inventory_items')
      .select('*, product_types(name)')
      .eq('serial_number', serialUpper)
      .single()

    if (data) addScannedItem(data)
    else {
      setLastNotFound(serialUpper)
      toast.error('Serial number not found in inventory')
      setSerial('')
    }
  }

  function addScannedItem(item) {
    scannedSerialsRef.current.add(item.serial_number)
    setScanHistory(current => [{ ...item, scanned_at: new Date().toISOString() }, ...current])
    setSerial('')
    toast.success(`Scanned: ${item.serial_number}`)
  }

  async function handleManualLookup(e) {
    e.preventDefault()
    await lookupSerial(serial)
  }

  function clearHistory() {
    scannedSerialsRef.current = new Set()
    setScanHistory([])
    setLastNotFound('')
    setMissingItems([])
    setCheckDone(false)
  }

  async function checkMissingItems() {
    let inventory = getStoredDemoItems()

    if (!isDemo) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, serial_number, product_name, weight_grams, purchase_price, status, product_types(name)')
        .eq('status', 'available')
        .order('serial_number')
      if (error) { toast.error(error.message); return }
      inventory = data ?? []
    }

    const scannedSerials = new Set(scanHistory.map(item => item.serial_number))
    const scopedInventory = checkProduct === 'all'
      ? inventory
      : inventory.filter(item => itemProductName(item) === checkProduct)
    const missing = scopedInventory.filter(item => !scannedSerials.has(item.serial_number))
    setMissingItems(missing)
    setCheckDone(true)
    if (missing.length === 0) toast.success('All available items are scanned')
    else toast.error(`${missing.length} item${missing.length === 1 ? '' : 's'} missing`)
  }

  const productOptions = Array.from(new Set([
    ...inventoryProducts,
    ...scanHistory.map(itemProductName),
  ])).filter(Boolean)

  return (
    <div className="p-8 fade-up max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Scan QR Code</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Scan continuously and keep every found item in the list</p>
      </div>

      <div className="card p-6 mb-6">
        <div id="qr-reader" className={`rounded-lg overflow-hidden mb-4 ${!scanning ? 'hidden' : ''}`} />

        {!scanning ? (
          <button onClick={startScan} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
            <QrCode size={16} /> Start Continuous Scan
          </button>
        ) : (
          <button onClick={stopScan} className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <StopCircle size={16} /> Stop Scanning
          </button>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h3 className="text-xs text-[#6b5a42] uppercase tracking-wider mb-3">Or enter serial manually</h3>
        <form onSubmit={handleManualLookup} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. RNG-0001"
            value={serial}
            onChange={e => setSerial(e.target.value)}
          />
          <button type="submit" className="btn-gold px-4">Look Up</button>
        </form>
      </div>

      {lastNotFound && (
        <div className="card p-6 fade-up mb-6">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-red-400" />
            <span className="text-red-400 text-sm">Serial not found: {lastNotFound}</span>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2012] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base text-[#f5ead8]">Scanned Items</h2>
            <p className="text-[#4a3c2a] text-xs mt-1">{scanHistory.length} item{scanHistory.length === 1 ? '' : 's'} scanned</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-44" value={checkProduct} onChange={e => setCheckProduct(e.target.value)}>
              <option value="all">All products</option>
              {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
            </select>
            <button onClick={checkMissingItems} className="btn-gold flex items-center gap-2">
              <Search size={14} /> Check Missing
            </button>
            {scanHistory.length > 0 && (
              <button onClick={clearHistory} className="btn-ghost flex items-center gap-2">
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {checkDone && (
          <div className="m-5 rounded-lg border border-[#2a2012] bg-[#0d0b07] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#f5ead8]">Missing Check Result</span>
              <span className={missingItems.length === 0 ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                {missingItems.length === 0 ? 'Complete' : `${missingItems.length} missing`}
              </span>
            </div>
            {missingItems.length > 0 ? (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {missingItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-[#1e170d] rounded-lg text-sm">
                    <span className="font-mono text-red-400 text-xs">{item.serial_number}</span>
                    <span className="text-[#8a7560]">{itemProductName(item)}</span>
                    <span className="text-[#4a3c2a] text-xs">{item.weight_grams}g</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-400 text-sm">No missing available items.</p>
            )}
          </div>
        )}

        {scanHistory.length === 0 ? (
          <div className="p-5 text-[#4a3c2a] text-sm">No items scanned yet</div>
        ) : (
          <div className="divide-y divide-[#1a1208] max-h-96 overflow-y-auto">
            {scanHistory.map(item => (
              <div key={`${item.serial_number}-${item.scanned_at}`} className="p-5 fade-up">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Item Found</span>
                  <span className="ml-auto text-[#4a3c2a] text-xs">{new Date(item.scanned_at).toLocaleTimeString('en-IN')}</span>
                </div>
                <div className="space-y-2">
                  <Row label="Serial" value={<span className="font-mono text-gold-400">{item.serial_number}</span>} />
                  <Row label="Category" value={item.product_types?.name} />
                  <Row label="Product" value={itemProductName(item)} />
                  <Row label="Weight" value={`${item.weight_grams}g`} />
                  <Row label="Purchase Price" value={item.purchase_price ? `Rs. ${Number(item.purchase_price).toLocaleString('en-IN')}` : '-'} />
                  <Row label="Status" value={
                    <span className={
                      item.status === 'available' ? 'badge-available' :
                      item.status === 'sold' ? 'badge-sold' : 'badge-audit'
                    }>{item.status}</span>
                  } />
                  {item.notes && <Row label="Notes" value={item.notes} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1a1208] last:border-0">
      <span className="text-xs text-[#4a3c2a] uppercase tracking-wider">{label}</span>
      <span className="text-sm text-[#f5ead8]">{value}</span>
    </div>
  )
}
