import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type ValydUser } from "@/lib/auth";

const GoogleCallback = () => {
  const [params] = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const u = params.get("u");
    if (!u) {
      navigate("/login?error=google", { replace: true });
      return;
    }
    try {
      const user = JSON.parse(atob(u)) as ValydUser;
      loginWithGoogle(user);
      navigate("/dashboard", { replace: true });
    } catch {
      navigate("/login?error=google", { replace: true });
    }
  }, [params, loginWithGoogle, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
