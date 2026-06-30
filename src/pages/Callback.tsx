import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Stethoscope, CheckCircle, XCircle } from "lucide-react";
import {
  useAuth,
  linkValydAccount,
  verifyShiftWithValydOidc,
  VALYD_LINK_FLAG,
  VALYD_SHIFT_FLAG,
  VALYD_SHIFT_STATE,
} from "@/lib/auth";

const Callback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [linking, setLinking] = useState(
    localStorage.getItem(VALYD_LINK_FLAG) === "1" || localStorage.getItem(VALYD_SHIFT_FLAG) === "1",
  );

  useEffect(() => {
    const code = searchParams.get("code");
    const linkMode = localStorage.getItem(VALYD_LINK_FLAG) === "1";
    const shiftMode = localStorage.getItem(VALYD_SHIFT_FLAG) === "1";

    // Shift verification — re-login with Valyd, read the IdP face/verification
    // result, keep the current app session.
    if (shiftMode && code) {
      localStorage.removeItem(VALYD_SHIFT_FLAG);
      // CSRF: the OIDC state must match what we sent.
      const expectedState = localStorage.getItem(VALYD_SHIFT_STATE);
      localStorage.removeItem(VALYD_SHIFT_STATE);
      if (expectedState && searchParams.get("state") !== expectedState) {
        setError("Shift verification could not be validated (state mismatch). Please try again.");
        setProcessing(false);
        return;
      }
      setLinking(true);
      verifyShiftWithValydOidc(code)
        .then(() => {
          setProcessing(false);
          setTimeout(() => navigate("/dashboard", { replace: true }), 600);
        })
        .catch((err) => {
          setError(err.message || "Could not verify your shift with Valyd.");
          setProcessing(false);
        });
      return;
    }

    // Linking a Valyd account to an existing (e.g. Google) session — do NOT
    // replace the current app session.
    if (linkMode && code) {
      localStorage.removeItem(VALYD_LINK_FLAG);
      setLinking(true);
      linkValydAccount(code)
        .then(() => {
          setProcessing(false);
          setTimeout(() => navigate("/dashboard", { replace: true }), 600);
        })
        .catch((err) => {
          setError(err.message || "Could not connect your Valyd account.");
          setProcessing(false);
        });
      return;
    }

    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (!code) {
      setError("No authorization code received. Please try logging in again.");
      setProcessing(false);
      return;
    }

    login(code)
      .then(() => {
        setProcessing(false);
        setTimeout(() => navigate("/dashboard", { replace: true }), 800);
      })
      .catch((err) => {
        setError(err.message || "Authentication failed. Please try again.");
        setProcessing(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground tracking-tight">
              Valyd<span className="text-primary">Health</span>
            </span>
          </div>

          <div className="rounded-2xl bg-card border border-border shadow-lg p-8 text-center">
            {processing && !error && (
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">
                    {linking ? "Connecting Valyd" : "Authenticating"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {linking ? "Linking your Valyd account..." : "Verifying your identity with Valyd..."}
                  </p>
                </div>
              </div>
            )}

            {!processing && !error && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                  <CheckCircle className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Success!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Redirecting to your dashboard...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Login Failed</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                </div>
                <button
                  onClick={() => navigate("/login", { replace: true })}
                  className="mt-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Callback;
