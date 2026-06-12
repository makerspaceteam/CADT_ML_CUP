// ============================================
// shared/auth.js
// Depends on: supabaseClient (from shared/supabase-client.js)
// ============================================

async function signUp(email, password, username, fullName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username, full_name: fullName } }
  });
  return { data, error };
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) window.location.href = 'login.html';
  return { error };
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabaseClient   // ✅ supabaseClient not supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_admin) {
    alert('Access denied: Admins only.');
    window.location.href = 'index.html';
    return null;
  }
  return profile;
}

async function updateNavbar() {
  const guestEl = document.getElementById('nav-guest');
  const userEl = document.getElementById('nav-user');
  const usernameEl = document.getElementById('nav-username');
  const adminEl = document.getElementById('nav-admin');

  const profile = await getCurrentProfile();

  if (profile) {
    if (guestEl) guestEl.style.display = 'none';
    if (userEl) userEl.style.display = 'flex';
    if (usernameEl) usernameEl.textContent = profile.username;
    if (adminEl) adminEl.style.display = profile.is_admin ? 'inline-block' : 'none';
  } else {
    if (guestEl) guestEl.style.display = 'flex';
    if (userEl) userEl.style.display = 'none';
    if (adminEl) adminEl.style.display = 'none';
  }
}