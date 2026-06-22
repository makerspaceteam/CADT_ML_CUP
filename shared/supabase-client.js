// shared/supabase-client.js
import CONFIG from './config.js';

const supabaseClient = supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

export { supabaseClient };