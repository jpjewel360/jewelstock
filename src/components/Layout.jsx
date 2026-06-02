import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  LayoutDashboard, Package, ShoppingBag, QrCode,
  Settings, LogOut, Gem, MinusCircle, Boxes
} from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/stock-view', icon: Boxes, label: 'Stock View' },
  { to: '/sales', icon: ShoppingBag, label: 'Sales' },
  { to: '/sell-reduce', icon: MinusCircle, label: 'Sell / Reduce' },
  { to: '/scan', icon: QrCode, label: 'Scan Item' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 flex-shrink-0 bg-[#0d0b07] border-b md:border-b-0 md:border-r border-[#2a2012] flex flex-col md:min-h-screen">
        {/* Logo */}
        <div className="px-4 py-4 md:px-5 md:py-6 border-b border-[#2a2012]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gold-500/20 border border-gold-600/40 flex items-center justify-center">
              <Gem size={14} className="text-gold-400" />
            </div>
            <div>
              <div className="font-display text-sm text-[#f5ead8] leading-tight">Scan Gem</div>
              <div className="font-mono text-[10px] text-[#4a3c2a] uppercase tracking-widest">Flow</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex md:flex-col md:flex-1 gap-2 md:gap-0 overflow-x-auto md:overflow-visible px-3 py-3 md:py-4 md:space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-gold-500/15 text-gold-400 border border-gold-600/25'
                    : 'text-[#6b5a42] hover:text-[#f5ead8] hover:bg-[#1e170d]'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}

          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-gold-500/15 text-gold-400 border border-gold-600/25'
                  : 'text-[#6b5a42] hover:text-[#f5ead8] hover:bg-[#1e170d]'
              }`
            }
          >
            <Settings size={15} />
            Admin
          </NavLink>
        </nav>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-3 md:block md:py-4 border-t border-[#2a2012]">
          <div className="px-3 py-2 mb-0 md:mb-1 min-w-0 flex-1">
            <div className="text-xs text-[#f5ead8] truncate">{user?.email}</div>
            <div className="mt-1">
              <span className="badge-admin">admin</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm text-[#6b5a42] hover:text-red-400 hover:bg-red-900/10 md:w-full transition-all"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
