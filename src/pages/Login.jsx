import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { Gem } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn, signUp, enterDemoWorkspace } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        toast.success('Welcome back')
      } else {
        const { error } = await signUp(email, password)
        if (error) throw error
        toast.success('Account created — you can sign in now')
        setMode('login')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0806] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm px-4 fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500/15 border border-gold-600/30 mb-4">
            <Gem size={24} className="text-gold-400" />
          </div>
          <h1 className="font-display text-2xl text-[#f5ead8]">Scan Gem Flow</h1>
          <p className="text-[#4a3c2a] text-sm mt-1">Jewellery Inventory System</p>
        </div>

        <div className="card p-6">
          <div className="flex mb-6 bg-[#0d0b07] rounded-lg p-1">
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                  mode === m
                    ? 'bg-gold-500/20 text-gold-400'
                    : 'text-[#4a3c2a] hover:text-[#8a7560]'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#6b5a42] mb-1.5 block uppercase tracking-wider">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-[#4a3c2a] text-xs text-center mt-4">
              First account created becomes <span className="text-gold-600">admin</span>
            </p>
          )}

          <div className="mt-5 pt-5 border-t border-[#2a2012]">
            <button
              type="button"
              onClick={enterDemoWorkspace}
              className="btn-ghost w-full py-2.5"
            >
              Open Demo Workspace
            </button>
            <p className="text-[#4a3c2a] text-xs text-center mt-3">
              Use this when Supabase is unavailable.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
