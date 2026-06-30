import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Globe,
  Monitor,
  ChevronDown,
  Hash,
  Calendar,
  MapPin,
  ScanFace,
  BadgeCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LoginRecord {
  id: number;
  user_id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  pollus_id: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  is_doctor: number;
  ip_address: string | null;
  user_agent: string | null;
  logged_in_at: string;
}

interface VerifyRecord {
  session_id: string;
  workflow: string | null;
  status: string;
  updated_at: string;
}

type FeedItem =
  | { kind: "login"; id: string; time: string; login: LoginRecord }
  | { kind: "verify"; id: string; time: string; verify: VerifyRecord };

const verifyMeta: Record<string, { label: string; icon: typeof ScanFace }> = {
  identity: { label: "Identity Verification", icon: ScanFace },
  license: { label: "License Verification", icon: BadgeCheck },
};

const verifyStatusStyles: Record<string, { tone: string; icon: typeof CheckCircle2 }> = {
  APPROVED: { tone: "bg-accent/15 text-accent", icon: CheckCircle2 },
  DECLINED: { tone: "bg-destructive/15 text-destructive", icon: XCircle },
  ABANDONED: { tone: "bg-warning/15 text-warning", icon: AlertTriangle },
  EXPIRED: { tone: "bg-warning/15 text-warning", icon: AlertTriangle },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  return "Other";
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr + "Z");
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

function formatLocation(login: LoginRecord): string {
  const parts = [login.city, login.state, login.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}

export default function LoginHistorySection() {
  const { user } = useAuth();
  const [logins, setLogins] = useState<LoginRecord[]>([]);
  const [verifs, setVerifs] = useState<VerifyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const userId = user?.id ? String(user.id) : null;

  const loadActivity = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      await Promise.all([
        fetch(`/api/logins?user_id=${encodeURIComponent(userId)}&limit=50`)
          .then((r) => r.json())
          .then((res) => {
            if (res.success) {
              setLogins(res.data);
              setTotal(res.total);
            }
          }),
        fetch(`/api/verify/history?user_id=${encodeURIComponent(userId)}`)
          .then((r) => r.json())
          .then((res) => {
            if (res.success) setVerifs(res.data);
          }),
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadActivity();
    // VerifySection fires this when a verification reaches a terminal state.
    const onUpdate = () => loadActivity();
    window.addEventListener("valyd-verify-updated", onUpdate);
    return () => window.removeEventListener("valyd-verify-updated", onUpdate);
  }, [loadActivity]);

  if (loading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !userId) return null;

  const todayCount = logins.filter((l) => {
    const d = new Date(l.logged_in_at + "Z");
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  // Merge logins + verifications into one time-sorted activity feed.
  const feed: FeedItem[] = [
    ...logins.map((login): FeedItem => ({
      kind: "login",
      id: `login-${login.id}`,
      time: login.logged_in_at,
      login,
    })),
    ...verifs.map((verify): FeedItem => ({
      kind: "verify",
      id: `verify-${verify.session_id}`,
      time: verify.updated_at,
      verify,
    })),
  ].sort((a, b) => new Date(b.time + "Z").getTime() - new Date(a.time + "Z").getTime());

  const displayFeed = showAll ? feed : feed.slice(0, 10);
  const uniquePlaces = Array.from(new Set(logins.map((login) => formatLocation(login)))).filter(
    (place) => place !== "Unknown location"
  );

  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Your Login History
          </h3>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: "Total Sign-ins", value: total, icon: Hash },
              { label: "Today", value: todayCount, icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl bg-card border border-border p-4 text-center hover:shadow-md transition-shadow"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Login history list */}
          <div className="rounded-2xl bg-card border border-border shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h4 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Sessions
              </h4>
            </div>

            <motion.div variants={container} initial="hidden" animate="show">
              {displayFeed.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No activity yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {displayFeed.map((entry) =>
                    entry.kind === "login" ? (
                      <motion.div
                        key={entry.id}
                        variants={item}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatDate(entry.login.logged_in_at)}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {formatLocation(entry.login)}
                            </span>
                            {entry.login.ip_address && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {entry.login.ip_address}
                              </span>
                            )}
                            {entry.login.user_agent && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Monitor className="h-3 w-3" />
                                {parseUserAgent(entry.login.user_agent)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(entry.login.logged_in_at)}
                        </span>
                      </motion.div>
                    ) : (
                      (() => {
                        const meta = verifyMeta[entry.verify.workflow ?? ""] ?? {
                          label: "Verification",
                          icon: BadgeCheck,
                        };
                        const st = verifyStatusStyles[entry.verify.status] ?? {
                          tone: "bg-muted text-muted-foreground",
                          icon: Clock,
                        };
                        const MetaIcon = meta.icon;
                        const StatusIcon = st.icon;
                        return (
                          <motion.div
                            key={entry.id}
                            variants={item}
                            className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 shrink-0">
                              <MetaIcon className="h-4 w-4 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {entry.verify.status.charAt(0) + entry.verify.status.slice(1).toLowerCase()}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(entry.verify.updated_at)}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {timeAgo(entry.verify.updated_at)}
                            </span>
                          </motion.div>
                        );
                      })()
                    ),
                  )}
                </div>
              )}
            </motion.div>

            {feed.length > 10 && !showAll && (
              <div className="px-5 py-3 border-t border-border">
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Show all {feed.length} sessions
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-card border border-border shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h4 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Logged In Places
              </h4>
            </div>
            <div className="px-5 py-4">
              {uniquePlaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">No location data yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uniquePlaces.map((place) => (
                    <span
                      key={place}
                      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {place}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
