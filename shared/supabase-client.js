// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================
// Replace these with your actual Supabase project credentials
// Find them in: Supabase Dashboard > Project Settings > API

const SUPABASE_URL = 'https://rkhsxqeaebhhqywnuqmf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraHN4cWVhZWJoaHF5d251cW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDI1MjgsImV4cCI6MjA5NjgxODUyOH0.6Q5SnXKkRkUfRs66FMBG-CWPh58RLWGM1FSXq93dRjY';

// Initialize Supabase client (loaded from CDN in HTML)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
