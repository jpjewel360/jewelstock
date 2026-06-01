import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { Plus, Trash2, X, Tag } from 'lucide-react'
import { defaultFields, getStoredDemoTypes, saveStoredDemoTypes, getTypeFields, getTypeProducts } from '../lib/catalog.js'
import toast from 'react-hot-toast'

const emptyType = {
  name: '',
  prefix: '',
  purity_percent: '',
  fields: defaultFields,
  products: [''],
}

export default function Admin() {
  const { isDemo } = useAuth()
  const [types, setTypes] = useState([])
  const [showAddType, setShowAddType] = useState(false)
  const [newType, setNewType] = useState(emptyType)
  const [categoryInputs, setCategoryInputs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    if (isDemo) {
      setTypes(getStoredDemoTypes())
      setLoading(false)
      return
    }

    const { data: typesData } = await supabase.from('product_types').select('*').order('name')
    setTypes((typesData ?? []).map(t => ({
      ...t,
      fields: Array.isArray(t.fields) ? t.fields : defaultFields,
      products: Array.isArray(t.products) ? t.products : [],
    })))
    setLoading(false)
  }

  async function saveTypes(nextTypes) {
    setTypes(nextTypes)
    if (isDemo) saveStoredDemoTypes(nextTypes)
  }

  async function updateType(typeId, patch) {
    const nextTypes = types.map(type => type.id === typeId ? { ...type, ...patch } : type)
    await saveTypes(nextTypes)
    if (!isDemo) {
      const { error } = await supabase.from('product_types').update(patch).eq('id', typeId)
      if (error) { toast.error(error.message); fetchAll(); return }
    }
    toast.success('Category updated')
  }

  async function addType(e) {
    e.preventDefault()
    const cleanProducts = newType.products.map(p => p.trim()).filter(Boolean)
    const cleanFields = newType.fields.filter(f => f.label.trim()).map(f => ({
      ...f,
      id: f.id || f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      label: f.label.trim(),
    }))
    const record = {
      name: newType.name.trim(),
      prefix: newType.prefix.toUpperCase().trim(),
      purity_percent: newType.purity_percent ? parseFloat(newType.purity_percent) : null,
      fields: cleanFields,
      products: cleanProducts,
    }

    if (isDemo) {
      await saveTypes([...types, { ...record, id: `type-${Date.now()}` }])
    } else {
      const { error } = await supabase.from('product_types').insert(record)
      if (error) { toast.error(error.message); return }
      fetchAll()
    }

    toast.success('Category added')
    setShowAddType(false)
    setNewType(emptyType)
  }

  async function deleteType(id) {
    if (!confirm('Delete this category?')) return
    if (isDemo) {
      await saveTypes(types.filter(type => type.id !== id))
    } else {
      const { error } = await supabase.from('product_types').delete().eq('id', id)
      if (error) { toast.error(error.message); return }
      fetchAll()
    }
    toast.success('Category deleted')
  }

  async function addProduct(type) {
    const value = categoryInputs[type.id]?.product?.trim()
    if (!value) return
    await updateType(type.id, { products: [...getTypeProducts(type), value] })
    setCategoryInputs(current => ({ ...current, [type.id]: { ...current[type.id], product: '' } }))
  }

  async function deleteProduct(type, product) {
    await updateType(type.id, { products: getTypeProducts(type).filter(p => p !== product) })
  }

  async function addField(type) {
    const label = categoryInputs[type.id]?.field?.trim()
    if (!label) return
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const fields = getTypeFields(type)
    if (fields.some(f => f.id === id)) { toast.error('Field already exists'); return }
    await updateType(type.id, { fields: [...fields, { id, label, type: 'text', required: false }] })
    setCategoryInputs(current => ({ ...current, [type.id]: { ...current[type.id], field: '' } }))
  }

  async function deleteField(type, field) {
    if (field.builtin) { toast.error('Built-in fields cannot be deleted'); return }
    await updateType(type.id, { fields: getTypeFields(type).filter(f => f.id !== field.id) })
  }

  return (
    <div className="p-8 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-[#f5ead8]">Admin</h1>
        <p className="text-[#4a3c2a] text-sm mt-1">Manage categories, products, fields and users</p>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-gold-500" />
            <h2 className="font-display text-base text-[#f5ead8]">Categories</h2>
          </div>
          <button onClick={() => setShowAddType(true)} className="btn-gold flex items-center gap-2">
            <Plus size={14} /> Add Category
          </button>
        </div>

        {types.length === 0 ? (
          <p className="text-[#4a3c2a] text-sm">No categories yet.</p>
        ) : (
          <div className="space-y-4">
            {types.map(type => (
              <div key={type.id} className="bg-[#1e170d] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[#f5ead8] text-sm">{type.name}</div>
                    <div className="font-mono text-gold-600 text-xs mt-1">{type.prefix}</div>
                  </div>
                  <button onClick={() => deleteType(type.id)} className="text-[#4a3c2a] hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs text-[#6b5a42] uppercase tracking-wider mb-2">Products</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getTypeProducts(type).map(product => (
                        <button key={product} onClick={() => deleteProduct(type, product)} className="text-xs px-2 py-1 rounded bg-[#0d0b07] text-[#f5ead8] hover:text-red-400">
                          {product} x
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className="input" placeholder="Add product" value={categoryInputs[type.id]?.product ?? ''} onChange={e => setCategoryInputs(current => ({ ...current, [type.id]: { ...current[type.id], product: e.target.value } }))} />
                      <button onClick={() => addProduct(type)} className="btn-gold px-3">Add</button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs text-[#6b5a42] uppercase tracking-wider mb-2">Fields</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getTypeFields(type).map(field => (
                        <button key={field.id} onClick={() => deleteField(type, field)} className="text-xs px-2 py-1 rounded bg-[#0d0b07] text-[#f5ead8] hover:text-red-400">
                          {field.label}{field.builtin ? '' : ' x'}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className="input" placeholder="Add field, e.g. Size" value={categoryInputs[type.id]?.field ?? ''} onChange={e => setCategoryInputs(current => ({ ...current, [type.id]: { ...current[type.id], field: e.target.value } }))} />
                      <button onClick={() => addField(type)} className="btn-gold px-3">Add</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddType && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg fade-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-[#f5ead8]">Add Category</h2>
              <button onClick={() => setShowAddType(false)} className="text-[#4a3c2a] hover:text-[#f5ead8]"><X size={18} /></button>
            </div>
            <form onSubmit={addType} className="space-y-4">
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Category Name</label>
                <input className="input" value={newType.name} onChange={e => setNewType(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cat 1" required />
              </div>
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Serial Prefix</label>
                <input className="input" value={newType.prefix} onChange={e => setNewType(f => ({ ...f, prefix: e.target.value }))} placeholder="e.g. CAT1" maxLength={6} required />
              </div>
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Products</label>
                <input className="input" value={newType.products.join(', ')} onChange={e => setNewType(f => ({ ...f, products: e.target.value.split(',') }))} placeholder="Anklet, Chain" />
              </div>
              <div>
                <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Extra Fields</label>
                <input className="input" value={newType.fields.filter(f => !f.builtin).map(f => f.label).join(', ')} onChange={e => setNewType(f => ({ ...f, fields: [...defaultFields, ...e.target.value.split(',').map(label => label.trim()).filter(Boolean).map(label => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label, type: 'text', required: false }))] }))} placeholder="Size, Type" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-gold flex-1">Add Category</button>
                <button type="button" onClick={() => setShowAddType(false)} className="btn-ghost flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
