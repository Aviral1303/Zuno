import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      // Seed from cache immediately for faster first paint
      try {
        const cached = localStorage.getItem('zuno_profile')
        if (cached) {
          try { setProfile(JSON.parse(cached)) } catch {}
        }
      } catch {}

      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      // Do not block UI on profile fetch
      if (session?.user) {
        fetchProfile(session.user.id).catch(() => {})
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        // Don't block UI; fetch profile in background
        if (session?.user) {
          fetchProfile(session.user.id).catch(() => {})
        } else {
          setProfile(null)
          try { localStorage.removeItem('zuno_profile') } catch {}
        }
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      console.log('Fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('Profile fetch result:', { data, error })

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error)
        // Don't throw error, just log it - missing profile shouldn't break auth
        return
      }

      setProfile(data)
      try { localStorage.setItem('zuno_profile', JSON.stringify(data)) } catch {}
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Don't let profile errors break authentication
    }
  }

  const signUp = async (email, password, fullName) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    setLoading(true)
    try {
      console.log('Attempting sign in with:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Sign in response:', { data, error })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Sign in error in context:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (profileData) => {
    if (!user) throw new Error('No user logged in')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    fetchProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
