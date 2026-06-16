// ============================================
// shared/auth.js
// No Supabase Auth — uses profiles table directly
// ============================================

async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signUp(email, password, teamName) {
  try {
    const displayName = teamName?.trim() || "Team";

    // Check if email already exists
    const { data: existing } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle();

    if (existing) {
      return { data: null, error: { message: 'Email already registered.' } };
    }

    const hashed = await hashPassword(password);

    const { data, error } = await supabaseClient
      .from('profiles')
      .insert({
        username: displayName,
        email: email.trim(),
        password: hashed
      })
      .select()
      .single();

    if (error) throw error;

    // Save to localStorage so user is "logged in"
    localStorage.setItem('current_user', JSON.stringify(data));

    return { data, error: null };

  } catch (error) {
    console.error("SignUp error:", error);
    return { data: null, error };
  }
}

async function signIn(email, password) {
  try {
    const hashed = await hashPassword(password);

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('email', email.trim())
      .eq('password', hashed)
      .maybeSingle();

    if (error || !data) {
      return { data: null, error: { message: 'Invalid email or password.' } };
    }

    // Refresh profile from DB before saving (ensures is_admin is accurate)
    localStorage.setItem('current_user', JSON.stringify(data));

    return { data, error: null };

  } catch (error) {
    return { data: null, error };
  }
}

function signOut() {
  localStorage.removeItem('current_user');
  window.location.href = 'login.html';
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('current_user');
    return null;
  }
}

// Fetches a fresh copy of the profile from DB and updates localStorage
async function refreshCurrentUser() {
  const user = getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return user; // fall back to cached
  localStorage.setItem('current_user', JSON.stringify(data));
  return data;
}

async function getCurrentProfile() {
  return getCurrentUser();
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

// ⚠️ IMPORTANT: This checks the localStorage copy of is_admin.
// Always enforce admin access server-side via Supabase RLS policies.
// Never rely on this alone for sensitive data writes.
function requireAdmin() {
  const user = getCurrentUser();
  if (!user || !user.is_admin) {
    alert('Access denied: Admins only.');
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

async function updateNavbar() {
  const guestEl = document.getElementById('nav-guest');
  const userEl = document.getElementById('nav-user');
  const usernameEl = document.getElementById('nav-username');
  const adminEl = document.getElementById('nav-admin');

  const mobileGuestEl = document.getElementById('mobile-nav-guest');
  const mobileUserEl = document.getElementById('mobile-nav-user');
  const mobileUsernameEl = document.getElementById('mobile-nav-username');
  const mobileAdminEl = document.getElementById('mobile-nav-admin');

  const profile = getCurrentUser();

  if (profile) {
    if (guestEl) guestEl.style.display = 'none';
    if (userEl) userEl.style.display = 'flex';
    if (usernameEl) usernameEl.textContent = '@' + profile.username;
    if (adminEl) adminEl.style.display = profile.is_admin ? 'inline-block' : 'none';

    if (mobileGuestEl) mobileGuestEl.style.display = 'none';
    if (mobileUserEl) mobileUserEl.style.display = 'flex';
    if (mobileUsernameEl) mobileUsernameEl.textContent = '@' + profile.username;
    if (mobileAdminEl) mobileAdminEl.style.display = profile.is_admin ? 'block' : 'none';
  } else {
    if (guestEl) guestEl.style.display = 'flex';
    if (userEl) userEl.style.display = 'none';
    if (adminEl) adminEl.style.display = 'none';

    if (mobileGuestEl) mobileGuestEl.style.display = 'flex';
    if (mobileUserEl) mobileUserEl.style.display = 'none';
    if (mobileAdminEl) mobileAdminEl.style.display = 'none';
  }
}