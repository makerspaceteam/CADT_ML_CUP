// ============================================
// shared/auth.js (FINAL FIXED VERSION)
// Supabase Auth ONLY
// ============================================


// ============================================
// SIGN UP
// ============================================

async function signUp(email, password, teamName) {
  try {
    const username = teamName?.trim();

    if (!username) {
      return { data: null, error: { message: "Team name is required" } };
    }

    if (!password || password.length < 6) {
      return { data: null, error: { message: "Password must be at least 6 characters" } };
    }

    // 1. Check username not already taken
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return { data: null, error: { message: "Team name already taken" } };
    }

    // 2. Create auth user — DB trigger will auto-create profiles row
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { data: null, error };
    }

    let user = data?.user;

    if (!user) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      user = sessionData?.session?.user;
    }

    if (!user) {
      return {
        data: null,
        error: { message: "Signup succeeded but user session not ready. Try login." }
      };
    }

    // 3. Update the profile row (created by DB trigger) with username
    // Trigger already inserted: id + email
    // We just need to add: username
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .update({ username, email: email.trim() })
      .eq("id", user.id)
      .select()
      .single();

    if (profileError) {
      return {
        data: null,
        error: { message: "Account created but profile update failed. Please contact admin." }
      };
    }

    localStorage.setItem("current_user", JSON.stringify(profile));

    return { data: profile, error: null };

  } catch (err) {
    return { data: null, error: err };
  }
}


// ============================================
// SIGN IN
// ============================================

async function signIn(email, password) {
  try {
    if (!password || password.length < 6) {
      return { data: null, error: { message: "Password must be at least 6 characters" } };
    }

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      return {
        data: null,
        error: { message: "Invalid email or password" }
      };
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      return {
        data: null,
        error: { message: "Profile not found. Please contact admin." }
      };
    }

    localStorage.setItem("current_user", JSON.stringify(profile));

    return { data: profile, error: null };

  } catch (err) {
    return {
      data: null,
      error: { message: "Login failed" }
    };
  }
}


// ============================================
// SIGN OUT
// ============================================

async function signOut() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem("current_user");
  window.location.href = "login.html";
}


// ============================================
// RESET PASSWORD
// ============================================

async function resetPassword(email) {
  try {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin + "/login.html"
      }
    );

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };

  } catch (err) {
    return {
      data: null,
      error: { message: "Failed to send reset email" }
    };
  }
}


// ============================================
// CURRENT USER
// ============================================

function getCurrentUser() {
  const raw = localStorage.getItem("current_user");
  return raw ? JSON.parse(raw) : null;
}


// ============================================
// REFRESH USER
// ============================================

async function refreshCurrentUser() {
  const { data: userData } = await supabaseClient.auth.getUser();

  if (!userData?.user) return null;

  const { data } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (!data) return null;

  localStorage.setItem("current_user", JSON.stringify(data));
  return data;
}


// ============================================
// AUTH GUARDS
// ============================================

async function requireAuth() {
  const { data: userData } = await supabaseClient.auth.getUser();

  if (!userData?.user) {
    localStorage.removeItem("current_user");
    window.location.href = "login.html";
    return null;
  }

  const local = getCurrentUser();
  if (!local || local.id !== userData.user.id) {
    return await refreshCurrentUser();
  }

  return local;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;

  if (!user.is_admin) {
    alert("Access denied: Admins only");
    window.location.href = "index.html";
    return null;
  }

  return user;
}


// ============================================
// NAVBAR
// ============================================

async function updateNavbar() {
  const guestEl = document.getElementById("nav-guest");
  const userEl = document.getElementById("nav-user");
  const usernameEl = document.getElementById("nav-username");
  const adminEl = document.getElementById("nav-admin");

  const mobileGuestEl = document.getElementById("mobile-nav-guest");
  const mobileUserEl = document.getElementById("mobile-nav-user");
  const mobileUsernameEl = document.getElementById("mobile-nav-username");
  const mobileAdminEl = document.getElementById("mobile-nav-admin");

  const profile = getCurrentUser();

  if (profile) {
    if (guestEl) guestEl.style.display = "none";
    if (userEl) userEl.style.display = "flex";
    if (usernameEl) usernameEl.textContent = "@" + profile.username;
    if (adminEl) adminEl.style.display = profile.is_admin ? "inline-block" : "none";

    if (mobileGuestEl) mobileGuestEl.style.display = "none";
    if (mobileUserEl) mobileUserEl.style.display = "flex";
    if (mobileUsernameEl) mobileUsernameEl.textContent = "@" + profile.username;
    if (mobileAdminEl) mobileAdminEl.style.display = profile.is_admin ? "block" : "none";
  } else {
    if (guestEl) guestEl.style.display = "flex";
    if (userEl) userEl.style.display = "none";
    if (adminEl) adminEl.style.display = "none";

    if (mobileGuestEl) mobileGuestEl.style.display = "flex";
    if (mobileUserEl) mobileUserEl.style.display = "none";
    if (mobileAdminEl) mobileAdminEl.style.display = "none";
  }
}