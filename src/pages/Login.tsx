import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Stethoscope, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getValydAuthUrl } from "@/lib/auth";

const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in failed. Please try again.",
  google_state: "Google sign-in could not be verified. Please try again.",
  google_token: "Could not complete Google sign-in. Please try again.",
  google_profile: "Could not read your Google profile. Please try again.",
  google_not_configured: "Google sign-in isn't configured on the server yet.",
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [params] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const err = params.get("error");
    if (err) setErrorMsg(GOOGLE_ERRORS[err] ?? "Sign-in failed. Please try again.");
  }, [params]);

  function handleValydLogin() {
    window.location.href = getValydAuthUrl();
  }

  function handleGoogleLogin() {
    window.location.href = "/api/auth/google/start";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Decorative blobs */}
      <div className="fixed -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
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

          {/* Card */}
          <div className="rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-heading font-bold text-foreground">Welcome Back</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to access your professional dashboard
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{errorMsg}</p>
              </div>
            )}

            {/* Email/Password form (static) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@pollus.com"
                    className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Sign In
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">or continue with</span>
              </div>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 active:scale-[0.98] transition-all mb-3"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Valyd button (functional) */}
            <button
              type="button"
              onClick={handleValydLogin}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-[#5558e6] hover:to-[#7c4fec] active:scale-[0.98] transition-all"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Login with Valyd
            </button>

            {/* Links */}
            <div className="mt-5 flex flex-col items-center gap-2">
              <a href="#" className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                Forgot your password?
              </a>
              <p className="text-xs text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
