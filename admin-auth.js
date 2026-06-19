const SPORTS_MISTAKES_ADMIN_EMAIL = "jason.susnick@gmail.com";
const SPORTS_MISTAKES_LOGIN_PAGE = "admin-login.html";

async function requireSportsMistakesAdmin(client) {
  const result = await client.auth.getSession();
  const session = result?.data?.session;

  if (!session) {
    const currentPage = window.location.pathname.split("/").pop();
    window.location.href =
      SPORTS_MISTAKES_LOGIN_PAGE + "?redirect=" + encodeURIComponent(currentPage);
    return false;
  }

  const email = (session.user?.email || "").toLowerCase();

  if (email !== SPORTS_MISTAKES_ADMIN_EMAIL.toLowerCase()) {
    document.body.innerHTML = `
      <div style="max-width:600px;margin:80px auto;background:#0d1b2e;color:white;border:1px solid #203852;border-radius:16px;padding:24px;font-family:Arial,sans-serif;">
        <h1>Admin Access Denied</h1>
        <p>You are signed in as <strong>${email}</strong>.</p>
        <p>This admin page is restricted.</p>
        <a href="${SPORTS_MISTAKES_LOGIN_PAGE}" style="color:#74b9ff;">Log in as admin</a>
      </div>
    `;
    return false;
  }

  return true;
}
