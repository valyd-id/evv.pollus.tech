import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  Loader2,
  ScanFace,
  IdCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  useAuth,
  loadValydAccountFromToken,
  readValydAccount,
  getValydAuthUrl,
  VALYD_LINK_FLAG,
  type ValydAccount,
  type ValydUser,
} from "@/lib/auth";

export default function VerifyShiftSection() {
  const { user, accessToken } = useAuth();
  const isValydLogin = !!accessToken && user?.provider !== "google";

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValydAccount | null>(null);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  // We can call the account API with either a direct Valyd session, or a
  // separately-linked Valyd account (e.g. when signed in with Google).
  const linked = readValydAccount();
  const hasAuth = isValydLogin || !!linked;

  const getAuth = useCallback((): { token: string; user: ValydUser } | null => {
    if (isValydLogin && accessToken && user) return { token: accessToken, user };
    const l = readValydAccount();
    return l ? { token: l.token, user: l.user } : null;
  }, [isValydLogin, accessToken, user]);

  const connect = useCallback(() => {
    localStorage.setItem(VALYD_LINK_FLAG, "1");
    window.location.href = getValydAuthUrl();
  }, []);

  const run = useCallback(async () => {
    const auth = getAuth();
    if (!auth) return;
    setLoading(true);
    setError(null);
    setExpired(false);
    try {
      const acc = await loadValydAccountFromToken(auth.token, auth.user);
      setResult(acc);
      setRan(true);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        setExpired(true);
        setError("Your Valyd session expired. Reconnect to verify.");
      } else {
        setError("Could not verify your shift. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [getAuth]);

  const ver = result?.verifications;
  const licenses = result?.licenses ?? [];
  const kycVerified = Boolean(ver?.id_verified ?? result?.user?.id_verified);
  const faceMatch = ver?.face_match;
  const verifiedCredential = licenses.find((l) => l.status && /active|verified/i.test(l.status));
  const hasCredential = licenses.length > 0;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Verify Shift
          </h3>

          <div className="rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Fingerprint className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-heading font-bold text-foreground">Verify your shift</h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Account API
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Checks your Valyd account before starting your shift via the account APIs (
                  <span className="font-mono text-xs">/verifications</span> &{" "}
                  <span className="font-mono text-xs">/licenses</span>).
                </p>

                {/* No Valyd session and nothing linked → connect first (e.g. Google login). */}
                {!hasAuth ? (
                  <>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Connect your Valyd account to verify your shift.
                    </p>
                    <button
                      type="button"
                      onClick={connect}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                    >
                      Connect Valyd account
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={run}
                    disabled={loading}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        {ran ? "Verify Again" : "Verify Shift"}
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{error}</p>
                      {expired && (
                        <button onClick={connect} className="mt-1 text-xs font-semibold text-primary hover:underline">
                          Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div className="mt-6">
                <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Result
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Credentials (from /licenses) */}
                  <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                      <IdCard className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credentials</p>
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                          verifiedCredential ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"
                        }`}
                      >
                        {verifiedCredential ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {verifiedCredential ? "Verified" : hasCredential ? "Not Active" : "None"}
                      </span>
                      {verifiedCredential?.type && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {verifiedCredential.type.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Face Match (from /verifications) */}
                  <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                      <ScanFace className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Face Match</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {typeof faceMatch === "number" ? `${Math.round(faceMatch * 100)}%` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* KYC Verified (from /verifications) */}
                  <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KYC Verified</p>
                      <span
                        className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                          kycVerified ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"
                        }`}
                      >
                        {kycVerified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {kycVerified ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
