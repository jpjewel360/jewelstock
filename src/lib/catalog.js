export const defaultFields = [
  { id: 'weight_grams', label: 'Weight', type: 'number', required: true, builtin: true },
]

export const demoTypes = [
  {
    id: 'cat1',
    name: 'Cat 1',
    prefix: 'CAT1',
    fields: [
      { id: 'weight_grams', label: 'Weight', type: 'number', required: true, builtin: true },
      { id: 'size', label: 'Size', type: 'text', required: false },
    ],
    products: ['Anklet', 'Chain'],
  },
  {
    id: 'cat2',
    name: 'Cat 2',
    prefix: 'CAT2',
    fields: [
      { id: 'weight_grams', label: 'Weight', type: 'number', required: true, builtin: true },
      { id: 'purchase_price', label: 'Price', type: 'number', required: false, builtin: true },
      { id: 'metal_type', label: 'Type', type: 'text', required: false },
    ],
    products: ['Bracelet', 'Ring'],
  },
]

export const demoItems = [
  {
    id: 'demo-1',
    product_type_id: 'cat1',
    product_name: 'Anklet',
    serial_number: 'ANK-0001',
    weight_grams: 4.52,
    purchase_price: null,
    field_values: { size: 'Small' },
    status: 'available',
    product_types: { name: 'Cat 1' },
  },
  {
    id: 'demo-2',
    product_type_id: 'cat1',
    product_name: 'Chain',
    serial_number: 'CHA-0001',
    weight_grams: 11.75,
    purchase_price: null,
    field_values: { size: '22 inch' },
    status: 'available',
    product_types: { name: 'Cat 1' },
  },
  {
    id: 'demo-3',
    product_type_id: 'cat2',
    product_name: 'Bracelet',
    serial_number: 'BRA-0001',
    weight_grams: 18.1,
    purchase_price: 104500,
    field_values: { metal_type: 'Gold' },
    status: 'available',
    product_types: { name: 'Cat 2' },
  },
]

export function getStoredDemoTypes() {
  const stored = localStorage.getItem('demo_catalog_types')
  if (!stored) return demoTypes
  try {
    return JSON.parse(stored)
  } catch {
    return demoTypes
  }
}

export function saveStoredDemoTypes(types) {
  localStorage.setItem('demo_catalog_types', JSON.stringify(types))
}

export function getStoredDemoItems() {
  const stored = localStorage.getItem('demo_inventory_items')
  if (!stored) return demoItems
  try {
    return JSON.parse(stored)
  } catch {
    return demoItems
  }
}

export function saveStoredDemoItems(items) {
  localStorage.setItem('demo_inventory_items', JSON.stringify(items))
}

export function getStoredDemoSales() {
  const stored = localStorage.getItem('demo_sales_history')
  if (!stored) return []
  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

export function saveStoredDemoSales(sales) {
  localStorage.setItem('demo_sales_history', JSON.stringify(sales))
}

export function addStoredDemoSale(item, sale = {}) {
  const sales = getStoredDemoSales()
  const salePrice = Number(sale.sale_price ?? item.purchase_price ?? 0)
  const purchaseRate = Number(sale.purchase_rate ?? item.purchase_price ?? 0)
  const record = {
    id: `demo-sale-${Date.now()}`,
    inventory_item_id: item.id,
    sale_price: salePrice,
    purchase_rate: purchaseRate,
    profit: Number(sale.profit ?? salePrice - purchaseRate),
    buyer_name: sale.buyer_name ?? null,
    buyer_phone: sale.buyer_phone ?? null,
    sold_at: new Date().toISOString(),
    inventory_items: item,
  }
  saveStoredDemoSales([record, ...sales])
  return record
}

export function productPrefix(productName) {
  return (productName || 'ITM')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')
}

export function nextSerialForProduct(items, productName) {
  const prefix = productPrefix(productName)
  const lastNumber = items
    .map(item => item.serial_number || '')
    .filter(serial => serial.startsWith(`${prefix}-`))
    .map(serial => Number(serial.split('-')[1]))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0)
  return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`
}

export function getTypeFields(type) {
  return Array.isArray(type?.fields) && type.fields.length > 0 ? type.fields : defaultFields
}

export function getTypeProducts(type) {
  return Array.isArray(type?.products) ? type.products : []
}

export function itemProductName(item) {
  return item.product_name || item.product_types?.name || 'Product'
}

export function itemFieldValue(item, field) {
  if (field.id === 'weight_grams') return item.weight_grams ? `${Number(item.weight_grams)}g` : ''
  if (field.id === 'purchase_price') return item.purchase_price ? `Rs. ${Number(item.purchase_price).toLocaleString('en-IN')}` : ''
  return item.field_values?.[field.id] ?? ''
}
