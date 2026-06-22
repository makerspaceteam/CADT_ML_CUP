// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================
// Replace these with your actual Supabase project credentials
// Find them in: Supabase Dashboard > Project Settings > API

// const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);
