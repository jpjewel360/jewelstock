import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return localStorage.getItem('demo_workspace') === 'true'
      ? { id: 'demo-user', email: 'demo@local.workspace' }
      : null
  })
  const [role, setRole] = useState(() => localStorage.getItem('demo_workspace') === 'true' ? 'admin' : null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem('demo_workspace') === 'true')

  useEffect(() => {
    if (isDemo) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { setRole('admin'); setLoading(false) }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { setRole('admin'); setLoading(false) }
      else { setRole(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signOut = () => {
    localStorage.removeItem('demo_workspace')
    setIsDemo(false)
    setUser(null)
    setRole(null)
    return supabase.auth.signOut()
  }

  function enterDemoWorkspace() {
    localStorage.setItem('demo_workspace', 'true')
    setIsDemo(true)
    setUser({ id: 'demo-user', email: 'demo@local.workspace' })
    setRole('admin')
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, isDemo, signIn, signUp, signOut, enterDemoWorkspace }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
