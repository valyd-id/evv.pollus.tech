import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ScanFace,
  IdCard,
  BadgeCheck,
  Mail,
  Hash,
  Calendar,
  RefreshCw,
  Link2,
  Unlink,
  AlertTriangle,
  ArrowRight,
  Stethoscope,
  Loader2,
} from "lucide-react";
import {
  useAuth,
  getValydAuthUrl,
  readValydAccount,
  refreshValydAccount,
  clearValydAccount,
  loadValydAccountFromToken,
  VALYD_LINK_FLAG,
  type ValydAccount,
} from "@/lib/auth";

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ValydAccountSection() {
  const { user, accessToken } = useAuth();
  const [account, setAccount] = useState<ValydAccount | null>(readValydAccount);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the data comes from the current Valyd login (not a separate link).
  const [fromSession, setFromSession] = useState(false);

  // A direct Valyd login already has a usable session token (Google sessions
  // carry provider === "google").
  const isValydLogin = !!accessToken && user?.provider !== "google";

  // If logged in with Valyd directly and nothing was separately linked, load the
  // account straight from the session token — no "Connect" step needed.
  useEffect(() => {
    if (account || !isValydLogin || !accessToken || !user) return;
    let active = true;
    setLoading(true);
    loadValydAccountFromToken(accessToken, user)
      .then((acc) => {
        if (!active) return;
        setAccount(acc);
        setFromSession(true);
      })
      .catch(() => {
        /* leave as not-connected on failure */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account, isValydLogin, accessToken, user]);

  const connect = useCallback(() => {
    localStorage.setItem(VALYD_LINK_FLAG, "1");
    window.location.href = getValydAuthUrl();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (fromSession && accessToken && user) {
        setAccount(await loadValydAccountFromToken(accessToken, user));
      } else {
        setAccount(await refreshValydAccount());
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(
        status === 401
          ? "Your Valyd session expired. Reconnect to refresh verification data."
          : "Could not refresh your Valyd account.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [fromSession, accessToken, user]);

  const disconnect = useCallback(() => {
    clearValydAccount();
    setAccount(null);
    setError(null);
  }, []);

  const displayName =
    account?.user.full_name ||
    account?.user.name ||
    `${account?.user.first_name || ""} ${account?.user.last_name || ""}`.trim() ||
    account?.user.email ||
    "Valyd User";

  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Valyd Account
          </h3>

          <div className="rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8">
            {/* ── Loading from the current Valyd session ── */}
            {!account && loading ? (
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading your Valyd account…</p>
              </div>
            ) : !account ? (
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Link2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-heading font-bold text-foreground">Connect your Valyd account</h4>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    Link your Valyd identity to pull your verified profile, identity verification
                    status, and professional licenses straight from your Valyd account.
                  </p>
                  <button
                    type="button"
                    onClick={connect}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Connect Valyd account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ── Connected: header ── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      {account.user.avatar_url ? (
                        <img src={account.user.avatar_url} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <Stethoscope className="h-7 w-7 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-heading font-bold text-foreground">{displayName}</h4>
                      <p className="text-sm text-muted-foreground">{account.user.email || account.user.username || ""}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        <Link2 className="h-3 w-3" /> {fromSession ? "Signed in with Valyd" : "Valyd account linked"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refresh}
                      disabled={refreshing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-60 transition-all"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    {!fromSession && (
                      <button
                        type="button"
                        onClick={disconnect}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{error}</p>
                      <button onClick={connect} className="mt-1 text-xs font-semibold text-primary hover:underline">
                        Reconnect
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Profile (GET /userinfo) ── */}
                <div className="mt-6">
                  <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Profile · /userinfo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: Mail, label: "Email", value: account.user.email || "—" },
                      { icon: Hash, label: "Anon ID", value: account.user.anon_id || account.user.sub || "—" },
                      { icon: Calendar, label: "Member Since", value: formatDate(account.user.created_at) },
                      {
                        icon: ShieldCheck,
                        label: "ID Verified",
                        value: account.user.id_verified ? "Verified" : "Not Verified",
                        verified: account.user.id_verified,
                        isStatus: true,
                      },
                    ].map(({ icon: Icon, label, value, verified, isStatus }) => (
                      <div key={label} className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                          {isStatus ? (
                            <span
                              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                                verified ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${verified ? "bg-accent" : "bg-warning"}`} />
                              {value}
                            </span>
                          ) : (
                            <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Verifications (GET /verifications) ── */}
                <div className="mt-6">
                  <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Identity Verification · /verifications
                  </p>
                  {account.verifications ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                          <ScanFace className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID Verified</p>
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                              account.verifications.id_verified ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"
                            }`}
                          >
                            {account.verifications.id_verified ? "Verified" : "Not Verified"}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                          <BadgeCheck className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Face Match</p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {typeof account.verifications.face_match === "number"
                              ? `${Math.round(account.verifications.face_match * 100)}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                          <Calendar className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Checked</p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {formatDate(account.verifications.last_checked)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No verification data available for this account.</p>
                  )}
                </div>

                {/* ── Licenses (GET /licenses) ── */}
                <div className="mt-6">
                  <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Licenses · /licenses
                  </p>
                  {account.licenses && account.licenses.length > 0 ? (
                    <div className="rounded-xl border border-border overflow-hidden">
                      {account.licenses.map((lic, idx) => (
                        <div
                          key={`${lic.type}-${idx}`}
                          className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <IdCard className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {(lic.type || "License").replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {[lic.number, lic.issuer].filter(Boolean).join(" · ") || "—"}
                                {lic.expires_on ? ` · expires ${formatDate(lic.expires_on)}` : ""}
                              </p>
                            </div>
                          </div>
                          {lic.status && (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
                                /active/i.test(lic.status) ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {lic.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No licenses found on this Valyd account.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
