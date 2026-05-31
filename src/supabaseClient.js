import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://rxjrcbdeyouafhtizneh.supabase.co'
export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4anJjYmRleW91YWZodGl6bmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mjk1MjIsImV4cCI6MjA4OTEwNTUyMn0.yDgjAGZK3g-GR4GvlM-JOh2rfsYXRIW-_RwLt9lfi70'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
})
