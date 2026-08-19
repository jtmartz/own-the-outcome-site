// Shared Supabase client + auth helpers for the Own the Outcome client portal & admin panel.
// Loaded after the Supabase JS CDN script on every portal/admin page.

const SUPABASE_URL = "https://wfwcfdwozjfgyboajoya.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd2NmZHdvempmZ3lib2Fqb3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTYxMjAsImV4cCI6MjEwMjczMjEyMH0.pfXAquFxNcwQcgUJmePYW-FcX9NoVGoNMvLkU4twO60";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// A second, non-persisting client used ONLY when the admin panel creates a brand new
// client login (auth.signUp). Using a separate instance keeps that call from touching
// the admin's own logged-in session.
const sbCreate = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Require a logged-in CLIENT (not admin). Redirects to login.html if there's no
// session, or no matching row in public.clients. Also fills in every ".client-name"
// element on the page with the real business name. Returns the client row or null.
async function requireClient() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  const { data: client } = await sb.from('clients').select('*').eq('id', session.user.id).maybeSingle();
  if (!client) { window.location.href = 'login.html'; return null; }
  // Self-heal: if an email change was confirmed since we last saved the clients row
  // (Supabase Auth only flips session.user.email once the confirmation link is clicked),
  // sync it here so the displayed/stored email never gets ahead of what's actually confirmed.
  if (session.user.email && client.email !== session.user.email) {
    const newEmail = session.user.email;
    await sb.from('clients').update({ email: newEmail }).eq('id', client.id);
    client.email = newEmail;
  }
  document.querySelectorAll('.client-name').forEach(function (el) { el.textContent = client.business_name; });
  return client;
}

// Require a logged-in ADMIN. Redirects to login.html if there's no session, or the
// user isn't in public.admins. Returns the admin row or null.
async function requireAdmin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  const { data: admin } = await sb.from('admins').select('*').eq('id', session.user.id).maybeSingle();
  if (!admin) { window.location.href = 'login.html'; return null; }
  return admin;
}

// Wires every ".logout" link on the page to actually sign out and return to login.
function wireLogout() {
  document.querySelectorAll('.logout').forEach(function (el) {
    el.addEventListener('click', async function (e) {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = 'login.html';
    });
  });
}
wireLogout();

// Small date formatter used across the portal ("2026-09-14" -> "Sep 14").
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Basic HTML-escaping for interpolating database text into templates.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
