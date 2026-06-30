import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
const PORT = process.env.PORT || 3999;

// ─── Valyd Verify (Hosted) config — server-side only ──────────────────────────
const VERIFY_BASE_URL = (process.env.VALYD_VERIFY_BASE_URL || "https://verify.pollus.tech").replace(/\/$/, "");
const VERIFY_API_KEY = process.env.VALYD_VERIFY_API_KEY || "";
const VERIFY_WORKFLOW_ID = process.env.VALYD_VERIFY_WORKFLOW_ID || "";
const VERIFY_WORKFLOWS = {
  identity: process.env.VALYD_VERIFY_WORKFLOW_ID_IDENTITY || "",
  license: process.env.VALYD_VERIFY_WORKFLOW_ID_LICENSE || "",
};
const VERIFY_WEBHOOK_SECRET = process.env.VALYD_VERIFY_WEBHOOK_SECRET || "";
const APP_URL = (process.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");

// ─── Google OAuth (Authorization Code flow) — secret stays server-side ────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`;

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

app.use(cors());

// The Verify webhook signature is computed over the RAW request body, so this
// route must read the raw bytes BEFORE the global express.json() parser runs.
app.post("/api/verify/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const ts = req.get("x-valyd-timestamp");
    const sig = req.get("x-valyd-signature") || "";
    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : "";

    if (!VERIFY_WEBHOOK_SECRET) {
      console.error("Verify webhook received but VALYD_VERIFY_WEBHOOK_SECRET is not set");
      return res.status(500).send("webhook secret not configured");
    }
    if (!ts || !sig) return res.status(400).send("missing signature headers");

    // Reject stale events (> 5 minutes old).
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
      return res.status(400).send("stale timestamp");
    }

    const expected = crypto
      .createHmac("sha256", VERIFY_WEBHOOK_SECRET)
      .update(`${ts}.${raw}`)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).send("invalid signature");
    }

    const event = JSON.parse(raw);
    upsertVerification.run({
      session_id: event.session_id,
      vendor_data: event.vendor_data ?? null,
      workflow: null,
      status: event.status ?? null,
      event_type: event.type ?? null,
      decision_json: event.decision ? JSON.stringify(event.decision) : null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/verify/webhook error:", err);
    return res.status(500).send("internal error");
  }
});

app.use(express.json({ limit: "12mb" })); // base64 images can be large

app.set("trust proxy", true);

// ─── Record a login ──────────────────────────────────────────────────────────
const insertLogin = db.prepare(`
  INSERT INTO user_logins (user_id, email, username, full_name, pollus_id, country, state, city, is_doctor, ip_address, user_agent)
  VALUES (@user_id, @email, @username, @full_name, @pollus_id, @country, @state, @city, @is_doctor, @ip_address, @user_agent)
`);

// ─── Persist verification sessions (insert on create, update from webhook) ─────
const upsertVerification = db.prepare(`
  INSERT INTO verification_sessions (session_id, vendor_data, workflow, status, event_type, decision_json, updated_at)
  VALUES (@session_id, @vendor_data, @workflow, @status, @event_type, @decision_json, datetime('now'))
  ON CONFLICT(session_id) DO UPDATE SET
    vendor_data   = COALESCE(excluded.vendor_data, verification_sessions.vendor_data),
    workflow      = COALESCE(excluded.workflow, verification_sessions.workflow),
    status        = COALESCE(excluded.status, verification_sessions.status),
    event_type    = COALESCE(excluded.event_type, verification_sessions.event_type),
    decision_json = COALESCE(excluded.decision_json, verification_sessions.decision_json),
    updated_at    = datetime('now')
`);

function pickClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || null;
}

function normalizeIp(ip) {
  if (!ip) return null;
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

async function resolveLocation(ip) {
  if (!ip || isPrivateIp(ip)) return { city: null, state: null, country: null };
  try {
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`);
    if (!response.ok) return { city: null, state: null, country: null };
    const data = await response.json();
    if (data.status !== "success") return { city: null, state: null, country: null };
    return {
      city: data.city || null,
      state: data.regionName || null,
      country: data.country || null,
    };
  } catch {
    return { city: null, state: null, country: null };
  }
}

app.post("/api/logins", async (req, res) => {
  try {
    const { user, isDoctor } = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ success: false, error: "Missing user data" });
    }

    const ipAddress = normalizeIp(pickClientIp(req));
    const location = await resolveLocation(ipAddress);

    const result = insertLogin.run({
      user_id: String(user.id),
      email: user.email || null,
      username: user.username || null,
      full_name: user.full_name || user.name || null,
      pollus_id: user.pollus_id || null,
      country: location.country || user.country || null,
      state: location.state,
      city: location.city,
      is_doctor: isDoctor ? 1 : 0,
      ip_address: ipAddress,
      user_agent: req.get("user-agent") || null,
    });

    return res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("POST /api/logins error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─── Get login history ───────────────────────────────────────────────────────
app.get("/api/logins", (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.query.user_id || null;

    let query = "SELECT * FROM user_logins";
    const params = {};

    if (userId) {
      query += " WHERE user_id = @user_id";
      params.user_id = userId;
    }

    query += " ORDER BY logged_in_at DESC LIMIT @limit OFFSET @offset";
    params.limit = limit;
    params.offset = offset;

    const rows = db.prepare(query).all(params);

    let countQuery = "SELECT COUNT(*) as total FROM user_logins";
    if (userId) {
      countQuery += " WHERE user_id = @user_id";
    }
    const { total } = db.prepare(countQuery).get(userId ? { user_id: userId } : {});

    return res.json({ success: true, data: rows, total, limit, offset });
  } catch (err) {
    console.error("GET /api/logins error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─── Get login stats ─────────────────────────────────────────────────────────
app.get("/api/logins/stats", (_req, res) => {
  try {
    const totalLogins = db.prepare("SELECT COUNT(*) as count FROM user_logins").get();
    const uniqueUsers = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM user_logins").get();
    const todayLogins = db.prepare(
      "SELECT COUNT(*) as count FROM user_logins WHERE date(logged_in_at) = date('now')"
    ).get();
    const recentLogins = db
      .prepare("SELECT * FROM user_logins ORDER BY logged_in_at DESC LIMIT 10")
      .all();

    return res.json({
      success: true,
      data: {
        total_logins: totalLogins.count,
        unique_users: uniqueUsers.count,
        today_logins: todayLogins.count,
        recent: recentLogins,
      },
    });
  } catch (err) {
    console.error("GET /api/logins/stats error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─── Valyd Verify (Hosted) proxy ──────────────────────────────────────────────
// The App API key never leaves the server. The browser only ever sees the
// hosted session URL and the (non-authoritative) decision result.

function verifyConfigured(res) {
  if (!VERIFY_API_KEY) {
    res.status(500).json({
      success: false,
      error: { code: "config_error", message: "VALYD_VERIFY_API_KEY is not set on the server" },
    });
    return false;
  }
  return true;
}

async function verifyFetch(path, init = {}) {
  const res = await fetch(`${VERIFY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": VERIFY_API_KEY,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { success: false, error: { code: "bad_upstream", message: text } };
  }
  return { status: res.status, body };
}

// Create a hosted verification session and return the URL to redirect the user to.
app.post("/api/verify/session", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;

    // Select the workflow: an explicit workflow_id wins, otherwise map the
    // `workflow` key ("identity" | "license") to its configured id.
    const workflowKey = req.body?.workflow;
    const workflowId =
      req.body?.workflow_id ||
      (workflowKey && VERIFY_WORKFLOWS[workflowKey]) ||
      VERIFY_WORKFLOW_ID;

    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "missing_workflow",
          message: workflowKey
            ? `No workflow configured for "${workflowKey}". Set the matching VALYD_VERIFY_WORKFLOW_ID_* env var.`
            : "No workflow_id provided and no default workflow is configured.",
        },
      });
    }

    const { status, body } = await verifyFetch("/api/v2/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow_id: workflowId,
        redirect_url: `${APP_URL}/dashboard`,
        callback: `${APP_URL}/api/verify/webhook`,
        vendor_data: req.body?.vendor_data ? String(req.body.vendor_data) : undefined,
        metadata: req.body?.metadata,
      }),
    });

    if (body?.success && body?.data?.session_id) {
      upsertVerification.run({
        session_id: body.data.session_id,
        vendor_data: req.body?.vendor_data ? String(req.body.vendor_data) : null,
        workflow: typeof workflowKey === "string" ? workflowKey : null,
        status: body.data.status ?? "NOT_STARTED",
        event_type: null,
        decision_json: null,
      });
    }

    return res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/verify/session error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Failed to create session" } });
  }
});

// Retrieve current session status (used for polling after the user returns).
app.get("/api/verify/session/:id", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;
    const { status, body } = await verifyFetch(`/api/v2/session/${encodeURIComponent(req.params.id)}`);
    if (body?.data?.status) {
      upsertVerification.run({
        session_id: req.params.id,
        vendor_data: null,
        workflow: null,
        status: body.data.status,
        event_type: null,
        decision_json: null,
      });
    }
    return res.status(status).json(body);
  } catch (err) {
    console.error("GET /api/verify/session/:id error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Failed to retrieve session" } });
  }
});

// Authoritative decision + per-check breakdown for a finished session.
app.get("/api/verify/session/:id/decision", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;
    const { status, body } = await verifyFetch(`/api/v2/session/${encodeURIComponent(req.params.id)}/decision`);
    if (body?.success && body?.data) {
      upsertVerification.run({
        session_id: req.params.id,
        vendor_data: null,
        workflow: null,
        status: body.data.status ?? null,
        event_type: null,
        decision_json: JSON.stringify(body.data),
      });
    }
    return res.status(status).json(body);
  } catch (err) {
    console.error("GET /api/verify/session/:id/decision error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Failed to read decision" } });
  }
});

// Verification history for a user — surfaced in the dashboard activity list.
app.get("/api/verify/history", (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.json({ success: true, data: [] });

    const rows = db
      .prepare(
        `SELECT session_id, workflow, status, updated_at
         FROM verification_sessions
         WHERE vendor_data = @vendor_data
           AND status IN ('APPROVED', 'DECLINED', 'ABANDONED', 'EXPIRED')
         ORDER BY updated_at DESC
         LIMIT 50`,
      )
      .all({ vendor_data: String(userId) });

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/verify/history error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─── Valyd Verify standalone: face match (server-to-server, X-API-Key) ────────
app.post("/api/verify/face-match", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;
    const { image1, image2 } = req.body || {};
    if (!image1 || !image2) {
      return res.status(400).json({
        success: false,
        error: { code: "missing_images", message: "Both image1 (reference) and image2 (selfie) are required" },
      });
    }
    const { status, body } = await verifyFetch("/api/v2/face-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image1, image2 }),
    });
    return res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/verify/face-match error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Face match failed" } });
  }
});

// ─── Valyd Verify standalone: liveness (face scan) ────────────────────────────
app.post("/api/verify/liveness", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({
        success: false,
        error: { code: "missing_image", message: "A selfie image is required" },
      });
    }
    const { status, body } = await verifyFetch("/api/v2/liveness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    return res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/verify/liveness error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Liveness check failed" } });
  }
});

// ─── Valyd Verify standalone: age verification ────────────────────────────────
app.post("/api/verify/age", async (req, res) => {
  try {
    if (!verifyConfigured(res)) return;
    const { dob, bands } = req.body || {};
    if (!dob) {
      return res.status(400).json({
        success: false,
        error: { code: "missing_dob", message: "dob (YYYY-MM-DD) is required" },
      });
    }
    const { status, body } = await verifyFetch("/api/v2/age-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dob, bands: Array.isArray(bands) && bands.length ? bands : ["is_18_plus"] }),
    });
    return res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/verify/age error:", err);
    return res.status(502).json({ success: false, error: { code: "upstream_error", message: "Age verification failed" } });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// Step 1 — redirect the user to Google's consent screen.
app.get("/api/auth/google/start", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${APP_URL}/login?error=google_not_configured`);
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", `g_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2 — Google redirects back here with a code; exchange it server-side.
app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${APP_URL}/login?error=google`);

    const cookies = parseCookies(req);
    if (!code || !state || state !== cookies.g_oauth_state) {
      return res.redirect(`${APP_URL}/login?error=google_state`);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(`${APP_URL}/login?error=google_token`);

    const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const p = await profRes.json();
    if (!p.sub) return res.redirect(`${APP_URL}/login?error=google_profile`);

    const user = {
      id: `google_${p.sub}`,
      email: p.email || null,
      name: p.name || null,
      full_name: p.name || null,
      first_name: p.given_name || null,
      last_name: p.family_name || null,
      username: p.email ? p.email.split("@")[0] : null,
      avatar_url: p.picture || null,
      // Google only confirms the email address — it does NOT perform identity
      // (government-ID) verification, so this stays false for Google logins.
      email_verified: Boolean(p.email_verified),
      id_verified: false,
      provider: "google",
    };

    // Record the login so it shows up in the dashboard history.
    try {
      const ipAddress = normalizeIp(pickClientIp(req));
      const location = await resolveLocation(ipAddress);
      insertLogin.run({
        user_id: String(user.id),
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        pollus_id: null,
        country: location.country,
        state: location.state,
        city: location.city,
        is_doctor: 0,
        ip_address: ipAddress,
        user_agent: req.get("user-agent") || null,
      });
    } catch (logErr) {
      console.error("google login record error:", logErr);
    }

    // Clear the CSRF state cookie and hand the profile to the SPA.
    res.setHeader("Set-Cookie", `g_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    const encoded = encodeURIComponent(Buffer.from(JSON.stringify(user)).toString("base64"));
    return res.redirect(`${APP_URL}/auth/google?u=${encoded}`);
  } catch (err) {
    console.error("GET /api/auth/google/callback error:", err);
    return res.redirect(`${APP_URL}/login?error=google`);
  }
});

app.listen(PORT, () => {
  console.log(`EVV backend running on port ${PORT}`);
});
