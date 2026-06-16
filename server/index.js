import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
const PORT = process.env.PORT || 3999;

app.use(cors());
app.use(express.json());

app.set("trust proxy", true);

// ─── Record a login ──────────────────────────────────────────────────────────
const insertLogin = db.prepare(`
  INSERT INTO user_logins (user_id, email, username, full_name, pollus_id, country, state, city, is_doctor, ip_address, user_agent)
  VALUES (@user_id, @email, @username, @full_name, @pollus_id, @country, @state, @city, @is_doctor, @ip_address, @user_agent)
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

app.listen(PORT, () => {
  console.log(`EVV backend running on port ${PORT}`);
});
