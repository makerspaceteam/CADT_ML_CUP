// shared/supabase-client.js
const supabaseClient = supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;   // Make it global