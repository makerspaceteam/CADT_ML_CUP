// ============================================
// shared/auth.js
// Depends on: supabaseClient (from shared/supabase-client.js)
// ============================================

async function signUp(email, password, teamName) {
  try {
    const displayName = teamName?.trim() || "Team";

    // Main signup
    const { data, error: authError } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { 
          username: displayName 
        }
      }
    });

    if (authError) throw authError;

    // Try to create profile (this may fail silently if RLS blocks it)
    if (data.user) {
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          id: data.user.id,
          username: displayName,
          team_name: teamName?.trim()
        });

      if (profileError) {
        console.warn("Profile creation warning:", profileError.message);
      }
    }

    return { data, error: null };

  } catch (error) {
    console.error("SignUp error:", error);
    return { data: null, error };
  }
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
    .eq('id', user.id)
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

  // Mobile elements
  const mobileGuestEl = document.getElementById('mobile-nav-guest');
  const mobileUserEl = document.getElementById('mobile-nav-user');
  const mobileUsernameEl = document.getElementById('mobile-nav-username');
  const mobileAdminEl = document.getElementById('mobile-nav-admin');

  const profile = await getCurrentProfile();

  if (profile) {
    // Desktop
    if (guestEl) guestEl.style.display = 'none';
    if (userEl) userEl.style.display = 'flex';
    if (usernameEl) usernameEl.textContent = '@' + profile.username;
    if (adminEl) adminEl.style.display = profile.is_admin ? 'inline-block' : 'none';

    // Mobile
    if (mobileGuestEl) mobileGuestEl.style.display = 'none';
    if (mobileUserEl) mobileUserEl.style.display = 'flex';
    if (mobileUsernameEl) mobileUsernameEl.textContent = '@' + profile.username;
    if (mobileAdminEl) mobileAdminEl.style.display = profile.is_admin ? 'block' : 'none';

  } else {
    // Desktop
    if (guestEl) guestEl.style.display = 'flex';
    if (userEl) userEl.style.display = 'none';
    if (adminEl) adminEl.style.display = 'none';

    // Mobile
    if (mobileGuestEl) mobileGuestEl.style.display = 'flex';
    if (mobileUserEl) mobileUserEl.style.display = 'none';
    if (mobileAdminEl) mobileAdminEl.style.display = 'none';
  }
}