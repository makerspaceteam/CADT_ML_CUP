// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================
// Replace these with your actual Supabase project credentials
// Find them in: Supabase Dashboard > Project Settings > API

const supabaseClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);
