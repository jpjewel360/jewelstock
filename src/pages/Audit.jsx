import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Html5Qrcode } from 'html5-qrcode'
import { Play, StopCircle, CheckCircle, QrCode, Search } from 'lucide-react'
import { getStoredDemoItems, itemProductName } from '../lib/catalog.js'
import toast from 'react-hot-toast'

export default function Audit() {
  const { user, isDemo } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [scans, setScans] = useState([])
  const [missingItems, setMissingItems] = useState([])
  const [checkDone, setCheckDone] = useState(false)
  const [serial, setSerial] = useState('')
  const [loading, setLoading] = useState(true)
  const [cameraScanning, setCameraScanning] = useState(false)
  const [checkProduct, setCheckProduct] = useState('all')
  const html5QrRef = useRef(null)
  const scanLockRef = useRef(false)
  const scannedSerialsRef = useRef(new Set())

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => {
    scannedSerialsRef.current = new Set(scans.map(s => s.inventory_items?.serial_number).filter(Boolean))
  }, [scans])
  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}) }
  }, [])

  async function fetchSessions() {
    if (isDemo) {
      setSessions([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('audit_sessions')
      .select('*')
      .order('started_at', { ascending: false })
    setSessions(data ?? [])
    const active = data?.find(s => !s.ended_at)
    if (active) {
      setActiveSession(active)
      fetchScans(active.id)
    }
    setLoading(false)
  }

  async function fetchScans(sessionId) {
    if (isDemo) return

    const { data } = await supabase
      .from('audit_scans')
      .select('*, inventory_items(serial_number, product_name, weight_grams, product_types(name), status)')
      .eq('session_id', sessionId)
      .order('scanned_at', { ascending: false })
    setScans(data ?? [])
  }

  async function startAudit() {
    if (isDemo) {
      setActiveSession({ id: 'demo-audit', started_at: new Date().toISOString() })
      setScans([])
      scannedSerialsRef.current = new Set()
      setMissingItems([])
      setCheckDone(false)
      toast.success('Demo audit session started')
      return
    }

    const { data, error } = await supabase
      .from('audit_sessions')
      .insert({ started_by: user.id })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    setActiveSession(data)
    setScans([])
    scannedSerialsRef.current = new Set()
    setMissingItems([])
    setCheckDone(false)
    toast.success('Audit session started')
    fetchSessions()
  }

  async function endAudit() {
    await stopCameraScan()
    if (isDemo) {
      setActiveSession(null)
      setScans([])
      scannedSerialsRef.current = new Set()
      setMissingItems([])
      setCheckDone(false)
      toast.success('Demo audit session ended')
      return
    }

    const { error } = await supabase
      .from('audit_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', activeSession.id)
    if (error) { toast.error(error.message); return }
    setActiveSession(null)
    setScans([])
    scannedSerialsRef.current = new Set()
    setMissingItems([])
    setCheckDone(false)
    toast.success('Audit session ended')
    fetchSessions()
  }

  async function scanItem(e) {
    e.preventDefault()
    await recordSerial(serial)
  }

  async function recordSerial(rawSerial) {
    if (!rawSerial.trim() || !activeSession) return
    const serialUpper = rawSerial.trim().toUpperCase()
    setCheckDone(false)
    setMissingItems([])

    if (isDemo) {
      const item = getStoredDemoItems().find(i => i.serial_number === serialUpper)
      if (!item) { toast.error('Item not found'); setSerial(''); return }
      if (scannedSerialsRef.current.has(serialUpper)) { toast.error('Already scanned in this session'); setSerial(''); return }

      scannedSerialsRef.current.add(serialUpper)
      setScans(current => [{
        id: `demo-scan-${Date.now()}`,
        scanned_at: new Date().toISOString(),
        inventory_items: item,
      }, ...current])
      toast.success(`Scanned: ${serialUpper}`)
      setSerial('')
      return
    }

    const { data: item } = await supabase
      .from('inventory_items')
      .select('id, serial_number, product_name, weight_grams, status, product_types(name)')
      .eq('serial_number', serialUpper)
      .single()

    if (!item) { toast.error('Item not found'); setSerial(''); return }

    if (scannedSerialsRef.current.has(serialUpper)) { toast.error('Already scanned in this session'); setSerial(''); return }

    const { error } = await supabase.from('audit_scans').insert({
      session_id: activeSession.id,
      inventory_item_id: item.id,
      scanned_by: user.id
    })
    if (error) { toast.error(error.message); return }

    scannedSerialsRef.current.add(serialUpper)
    toast.success(`Scanned: ${serialUpper}`)
    setSerial('')
    fetchScans(activeSession.id)
  }

  async function startCameraScan() {
    setCameraScanning(true)
    scanLockRef.current = false
    html5QrRef.current = new Html5Qrcode('audit-qr-reader')
    try {
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (scanLockRef.current) return
          scanLockRef.current = true
          await recordSerial(decodedText)
          setTimeout(() => { scanLockRef.current = false }, 1200)
        },
        () => {}
      )
    } catch {
      toast.error('Camera access denied or not available')
      setCameraScanning(false)
    }
  }

  async function stopCameraScan() {
    if (html5QrRef.current) await html5QrRef.current.stop().catch(() => {})
    html5QrRef.current = null
    setCameraScanning(false)
  }

  async function checkMissingItems() {
    if (!activeSession) return
    let inventory = getStoredDemoItems()

    if (!isDemo) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, serial_number, product_name, weight_grams, status, product_types(name)')
        .eq('status', 'available')
        .order('serial_number')
      if (error) { toast.error(error.message); return }
      inventory = data ?? []
    }

    const scannedSerials = new Set(scans.map(s => s.inventory_items?.serial_number).filter(Boolean))
    const scopedInventory = checkProduct === 'all' ? inventory : inventory.filter(item => itemProductName(item) === checkProduct)
    const missing = scopedInventory.filter(item => !scannedSerials.has(item.serial_number))
    setMissingItems(missing)
    setCheckDone(true)
    if (missing.length === 0) toast.success('All available items are scanned')
    else toast.error(`${missing.length} item${missing.length === 1 ? '' : 's'} missing`)
  }

  const productOptions = Array.from(new Set([
    ...getStoredDemoItems().map(itemProductName),
    ...scans.map(scan => itemProductName(scan.inventory_items ?? {})),
  ])).filter(Boolean)

  return (
    <div className="p-8 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Stock Audit</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Continuously scan stock, then check database items that are missing</p>
      </div>

      {activeSession ? (
        <div className="card p-6 mb-6 border-gold-700/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Audit In Progress</span>
              <span className="text-[#4a3c2a] text-xs">- {scans.length} items scanned</span>
            </div>
            <button onClick={endAudit} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-700/40 px-3 py-1.5 rounded-lg transition-all">
              <StopCircle size={14} /> End Audit
            </button>
          </div>

          <div id="audit-qr-reader" className={`rounded-lg overflow-hidden mb-4 ${!cameraScanning ? 'hidden' : ''}`} />

          <div className="grid grid-cols-3 gap-3 mb-4">
            {!cameraScanning ? (
              <button onClick={startCameraScan} className="btn-gold flex items-center justify-center gap-2 py-2.5">
                <QrCode size={14} /> Start Continuous Scan
              </button>
            ) : (
              <button onClick={stopCameraScan} className="btn-ghost flex items-center justify-center gap-2 py-2.5">
                <StopCircle size={14} /> Stop Camera
              </button>
            )}
            <select className="input" value={checkProduct} onChange={e => setCheckProduct(e.target.value)}>
              <option value="all">All products</option>
              {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
            </select>
            <button onClick={checkMissingItems} className="btn-ghost flex items-center justify-center gap-2 py-2.5">
              <Search size={14} /> Check Missing
            </button>
          </div>

          <form onSubmit={scanItem} className="flex gap-2 mb-4">
            <input
              className="input flex-1"
              placeholder="Scan QR or type serial number..."
              value={serial}
              onChange={e => setSerial(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-gold px-4 flex items-center gap-2">
              <CheckCircle size={14} /> Record
            </button>
          </form>

          {checkDone && (
            <div className="mb-4 rounded-lg border border-[#2a2012] bg-[#0d0b07] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#f5ead8]">Audit Check Result</span>
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

          {scans.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {scans.map(scan => (
                <div key={scan.id} className="flex items-center justify-between py-2 px-3 bg-[#1e170d] rounded-lg text-sm">
                  <span className="font-mono text-gold-400 text-xs">{scan.inventory_items?.serial_number}</span>
                  <span className="text-[#8a7560]">{itemProductName(scan.inventory_items ?? {})}</span>
                  <span className="text-[#4a3c2a] text-xs">{new Date(scan.scanned_at).toLocaleTimeString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={startAudit} className="btn-gold flex items-center gap-2 mb-6">
          <Play size={15} /> Start New Audit
        </button>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2012]">
          <h2 className="font-display text-base text-[#f5ead8]">Past Audits</h2>
        </div>
        {loading ? (
          <div className="p-5 text-[#4a3c2a] text-sm">Loading...</div>
        ) : sessions.filter(s => s.ended_at).length === 0 ? (
          <div className="p-5 text-[#4a3c2a] text-sm">No completed audits yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#2a2012]">
              <tr className="text-[#4a3c2a] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Started</th>
                <th className="text-left px-5 py-3">Ended</th>
                <th className="text-left px-5 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1208]">
              {sessions.filter(s => s.ended_at).map(session => {
                const duration = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)
                return (
                  <tr key={session.id} className="hover:bg-[#1e170d]/40 transition-colors">
                    <td className="px-5 py-3 text-[#8a7560]">{new Date(session.started_at).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 text-[#8a7560]">{new Date(session.ended_at).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 text-[#4a3c2a]">{duration} min</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
