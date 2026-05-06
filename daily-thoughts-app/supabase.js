import { createClient } from '@supabase/supabase-js'

// You will get these from your Supabase dashboard
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

console.log("Testing URL: ", supabaseUrl)
console.log("Testing Key: ", supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)