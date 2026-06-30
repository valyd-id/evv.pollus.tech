import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const VALYD_CLIENT_ID = import.meta.env.VITE_VALYD_CLIENT_ID;
const VALYD_CLIENT_SECRET = import.meta.env.VITE_VALYD_CLIENT_SECRET;
const VALYD_BASE_URL = import.meta.env.VITE_VALYD_BASE_URL;
const VALYD_SCOPES = "profile verifications doctor_license";

function getRedirectUrl() {
  return `${window.location.origin}/callback`;
}

export function getValydAuthUrl(opts?: { forceReauth?: boolean }) {
  const redirectUrl = getRedirectUrl();
  let url = `${VALYD_BASE_URL}/auth?client_id=${VALYD_CLIENT_ID}&redirect_url=${redirectUrl}&scope=${encodeURIComponent(VALYD_SCOPES)}`;
  if (opts?.forceReauth) {
    // Force Valyd to re-authenticate (and re-scan the face) even if the user
    // already has an active Valyd session — required for per-shift verification.
    url += "&prompt=login&max_age=0";
  }
  return url;
}

// OIDC authorize endpoint — unlike TPSSO /auth, this is a standard OIDC endpoint
// that can honor prompt=login to force a fresh face scan each shift.
export function getValydOidcAuthUrl() {
  const state =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  try {
    localStorage.setItem(VALYD_SHIFT_STATE, state);
  } catch {
    // ignore
  }
  const params = new URLSearchParams({
    client_id: VALYD_CLIENT_ID,
    redirect_uri: getRedirectUrl(),
    response_type: "code",
    // Only scopes allowed for this project (+ the mandatory OIDC marker).
    scope: "openid profile verifications",
    state,
    prompt: "login",
    max_age: "0",
  });
  return `${VALYD_BASE_URL}/api/auth/oidc/authorize?${params.toString()}`;
}

// ─── Valyd account linking (separate from the app session) ────────────────────
// Lets a user (e.g. signed in with Google) connect their Valyd account and read
// its profile / verification / license data via the Valyd ID account endpoints,
// without replacing the current app session.
export const VALYD_ACCOUNT_KEY = "valyd_account";
export const VALYD_LINK_FLAG = "valyd_link";
export const VALYD_SHIFT_KEY = "valyd_shift";
export const VALYD_SHIFT_FLAG = "valyd_shift_verify";
export const VALYD_SHIFT_STATE = "valyd_shift_state";

export interface ValydVerifications {
  id_verified?: boolean;
  face_match?: number;
  last_checked?: string;
}

export interface ValydAccountLicense {
  type?: string;
  number?: string;
  status?: string;
  expires_on?: string;
  issuer?: string;
}

export interface ValydAccount {
  linkedAt: number;
  token: string;
  user: ValydUser;
  verifications: ValydVerifications | null;
  licenses: ValydAccountLicense[] | null;
}

async function tpssoGet(path: string, token: string) {
  const res = await fetch(`${VALYD_BASE_URL}/api/auth/tpsso${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Valyd ${path} failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return json?.data ?? null;
}

async function buildValydAccount(token: string, baseUser?: ValydUser): Promise<ValydAccount> {
  // /userinfo gates the call — if the token is expired this throws (401).
  const userData = await tpssoGet("/userinfo", token);
  const [ver, lic] = await Promise.allSettled([tpssoGet("/verifications", token), tpssoGet("/licenses", token)]);
  const verData = ver.status === "fulfilled" ? ver.value : null;
  const licData = lic.status === "fulfilled" ? lic.value : null;
  return {
    linkedAt: Date.now(),
    token,
    user: { ...(baseUser || {}), ...(userData || {}) },
    verifications: verData?.verifications ?? null,
    licenses: licData?.licenses ?? null,
  };
}

async function exchangeValydCode(code: string): Promise<{ token: string; user: ValydUser }> {
  const tokenRes = await fetch(`${VALYD_BASE_URL}/api/auth/tpsso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: VALYD_CLIENT_ID,
      client_secret: VALYD_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.success) throw new Error(tokenData.error?.message || "Valyd token exchange failed");
  return { token: tokenData.data.access_token, user: tokenData.data.user as ValydUser };
}

export async function linkValydAccount(code: string): Promise<ValydAccount> {
  const { token, user } = await exchangeValydCode(code);
  const account = await buildValydAccount(token, user);
  localStorage.setItem(VALYD_ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

// Build account data from an existing session token (e.g. when the user logged
// in with Valyd directly), without going through a separate link OAuth.
export async function loadValydAccountFromToken(token: string, baseUser: ValydUser): Promise<ValydAccount> {
  return buildValydAccount(token, baseUser);
}

// Lightweight read of just the identity verifications for a session token.
export async function getValydVerifications(token: string): Promise<ValydVerifications | null> {
  try {
    const data = await tpssoGet("/verifications", token);
    return data?.verifications ?? null;
  } catch {
    return null;
  }
}

// ─── Shift verification — re-login with Valyd; the IdP verifies the face and
// returns the verification result we read from /verifications. ────────────────
export interface ShiftVerification {
  verifiedAt: number;
  name?: string;
  idVerified: boolean;
  faceMatch?: number;
  lastChecked?: string;
}

export async function verifyShiftWithValyd(code: string): Promise<ShiftVerification> {
  const { token, user } = await exchangeValydCode(code);
  const account = await buildValydAccount(token, user);
  // Keep the account section fresh too.
  localStorage.setItem(VALYD_ACCOUNT_KEY, JSON.stringify(account));

  const shift: ShiftVerification = {
    verifiedAt: Date.now(),
    name:
      account.user.full_name ||
      account.user.name ||
      `${account.user.first_name || ""} ${account.user.last_name || ""}`.trim() ||
      account.user.email ||
      undefined,
    idVerified: Boolean(account.verifications?.id_verified ?? account.user.id_verified),
    faceMatch: account.verifications?.face_match,
    lastChecked: account.verifications?.last_checked,
  };
  localStorage.setItem(VALYD_SHIFT_KEY, JSON.stringify(shift));
  return shift;
}

async function bearerJson(path: string, token: string) {
  try {
    const res = await fetch(`${VALYD_BASE_URL}${path}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function verifyShiftWithValydOidc(code: string): Promise<ShiftVerification> {
  // Exchange the OIDC authorization code (client_secret_post, form-encoded).
  const tokenRes = await fetch(`${VALYD_BASE_URL}/api/auth/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUrl(),
      client_id: VALYD_CLIENT_ID,
      client_secret: VALYD_CLIENT_SECRET,
    }),
  });
  const tokenJson = await tokenRes.json();
  const at = tokenJson?.access_token || tokenJson?.data?.access_token;
  if (!at) {
    throw new Error(
      tokenJson?.error_description || tokenJson?.error?.message || tokenJson?.error || "Valyd OIDC token exchange failed",
    );
  }

  // Best-effort: pull whatever verification data the token grants access to.
  const [oidcUser, tpssoVer, tpssoUser] = await Promise.all([
    bearerJson("/api/auth/oidc/userinfo", at),
    bearerJson("/api/auth/tpsso/verifications", at),
    bearerJson("/api/auth/tpsso/userinfo", at),
  ]);
  const verifications = tpssoVer?.data?.verifications ?? null;
  const tpssoUserData = tpssoUser?.data ?? null;
  const name =
    oidcUser?.name ||
    tpssoUserData?.full_name ||
    [oidcUser?.first_name, oidcUser?.last_name].filter(Boolean).join(" ").trim() ||
    oidcUser?.email ||
    undefined;

  const shift: ShiftVerification = {
    verifiedAt: Date.now(),
    name,
    idVerified: Boolean(verifications?.id_verified ?? tpssoUserData?.id_verified),
    faceMatch: verifications?.face_match,
    lastChecked: verifications?.last_checked,
  };
  localStorage.setItem(VALYD_SHIFT_KEY, JSON.stringify(shift));
  return shift;
}

export function readShiftVerification(): ShiftVerification | null {
  try {
    const raw = localStorage.getItem(VALYD_SHIFT_KEY);
    return raw ? (JSON.parse(raw) as ShiftVerification) : null;
  } catch {
    return null;
  }
}

export function clearShiftVerification() {
  localStorage.removeItem(VALYD_SHIFT_KEY);
}

export async function refreshValydAccount(): Promise<ValydAccount> {
  const existing = readValydAccount();
  if (!existing) throw new Error("No linked Valyd account");
  const account = await buildValydAccount(existing.token, existing.user);
  localStorage.setItem(VALYD_ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

export function readValydAccount(): ValydAccount | null {
  try {
    const raw = localStorage.getItem(VALYD_ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as ValydAccount) : null;
  } catch {
    return null;
  }
}

export function clearValydAccount() {
  localStorage.removeItem(VALYD_ACCOUNT_KEY);
}

export interface ValydUser {
  id?: number;
  country?: string;
  email?: string | null;
  username?: string;
  name?: string;
  face_image_url?: string | null;
  pollus_id?: string;
  avatar_url?: string | null;
  created_at?: string;
  sub?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  anon_id?: string;
  id_verified?: boolean;
  provider?: string;
  is_16_plus?: boolean | null;
  is_18_plus?: boolean | null;
  is_21_plus?: boolean | null;
  is_30_plus?: boolean | null;
  is_65_plus?: boolean | null;
}

export interface DoctorLicenseFormatted {
  name?: string;
  license_number?: string;
  license_type?: string;
  status?: string;
  state?: string;
  npi?: string | null;
  verified_from?: string;
  expiration_date?: string;
}

export interface DoctorLicense {
  license_type?: string;
  status?: string;
  verified?: boolean;
  verified_from?: string;
  expire_at?: string;
  checked_at?: string;
  external_ref?: string;
  meta?: {
    test_fixture?: boolean;
    formatted?: DoctorLicenseFormatted;
    npi?: string | null;
    license_number?: string;
    source?: string;
  };
}

interface DoctorLicenseResponse {
  is_doctor?: boolean;
  matched_license?: DoctorLicense | null;
}

interface AuthState {
  user: ValydUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDoctor: boolean;
  doctorLicense: DoctorLicense | null;
  login: (code: string) => Promise<void>;
  loginWithGoogle: (user: ValydUser) => void;
  logout: () => void;
  fetchUserInfo: () => Promise<void>;
  checkDoctorLicense: () => Promise<void>;
}

const GOOGLE_SESSION_TOKEN = "google-session";

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ValydUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [doctorLicense, setDoctorLicense] = useState<DoctorLicense | null>(null);
  const [isDoctor, setIsDoctor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const forceLogout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setDoctorLicense(null);
    setIsDoctor(false);
    localStorage.removeItem("dh_auth");
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("dh_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAccessToken(parsed.accessToken);
        setRefreshToken(parsed.refreshToken);
        setUser(parsed.user);
        setDoctorLicense(parsed.doctorLicense || null);
        setIsDoctor(parsed.isDoctor || false);
      } catch {
        localStorage.removeItem("dh_auth");
      }
    }
    setIsLoading(false);
  }, []);

  function persist(data: {
    accessToken: string;
    refreshToken: string;
    user: ValydUser;
    doctorLicense?: DoctorLicense | null;
    isDoctor?: boolean;
  }) {
    localStorage.setItem("dh_auth", JSON.stringify(data));
  }

  const fetchDoctorLicense = useCallback(async (token: string): Promise<{ license: DoctorLicense | null; found: boolean }> => {
    const res = await fetch(`${VALYD_BASE_URL}/api/auth/tpsso/licenses/doctor`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      forceLogout();
      throw new Error("Session expired");
    }

    const data = await res.json();
    if (data.success && data.data) {
      const payload = data.data as DoctorLicenseResponse | DoctorLicense;

      // New API shape: { is_doctor, matched_license }
      if ("is_doctor" in (payload as DoctorLicenseResponse)) {
        const isDoctor = Boolean((payload as DoctorLicenseResponse).is_doctor);
        const matched = (payload as DoctorLicenseResponse).matched_license ?? null;
        return { license: matched, found: isDoctor };
      }

      // Backward compatibility with old API shape (direct license object)
      return { license: payload as DoctorLicense, found: true };
    }
    return { license: null, found: false };
  }, [forceLogout]);

  const checkDoctorLicense = useCallback(async () => {
    if (!accessToken || accessToken === GOOGLE_SESSION_TOKEN || !user) return;
    try {
      const { license, found } = await fetchDoctorLicense(accessToken);
      setDoctorLicense(license);
      setIsDoctor(found);
      persist({
        accessToken,
        refreshToken: refreshToken!,
        user,
        doctorLicense: license,
        isDoctor: found,
      });
    } catch {
      // forceLogout already called if 401
    }
  }, [accessToken, refreshToken, user, fetchDoctorLicense]);

  async function login(code: string) {
    setIsLoading(true);
    try {
      const tokenRes = await fetch(`${VALYD_BASE_URL}/api/auth/tpsso/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: VALYD_CLIENT_ID,
          client_secret: VALYD_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.success) {
        throw new Error(tokenData.error?.message || "Token exchange failed");
      }

      const at = tokenData.data.access_token;
      const rt = tokenData.data.refresh_token;
      const tokenUser = tokenData.data.user as ValydUser;

      setAccessToken(at);
      setRefreshToken(rt);
      setUser(tokenUser);

      let license: DoctorLicense | null = null;
      let doctorFound = false;

      try {
        const result = await fetchDoctorLicense(at);
        license = result.license;
        doctorFound = result.found;
      } catch {
        // license check failed — treat as not a doctor
      }

      setDoctorLicense(license);
      setIsDoctor(doctorFound);
      persist({
        accessToken: at,
        refreshToken: rt,
        user: tokenUser,
        doctorLicense: license,
        isDoctor: doctorFound,
      });

      // Record login to backend
      try {
        await fetch("/api/logins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: tokenUser, isDoctor: doctorFound }),
        });
      } catch {
        // non-critical
      }
    } finally {
      setIsLoading(false);
    }
  }

  function loginWithGoogle(googleUser: ValydUser) {
    setAccessToken(GOOGLE_SESSION_TOKEN);
    setRefreshToken(null);
    setUser(googleUser);
    setIsDoctor(false);
    setDoctorLicense(null);
    persist({
      accessToken: GOOGLE_SESSION_TOKEN,
      refreshToken: "",
      user: googleUser,
      doctorLicense: null,
      isDoctor: false,
    });
    // Record the session client-side too (the backend already logged it).
  }

  async function fetchUserInfo() {
    // Google sessions have no Valyd token — skip Valyd-only calls.
    if (!accessToken || accessToken === GOOGLE_SESSION_TOKEN) return;
    const res = await fetch(`${VALYD_BASE_URL}/api/auth/tpsso/userinfo`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      forceLogout();
      return;
    }

    const data = await res.json();
    if (data.success) {
      const merged = { ...user, ...data.data };
      setUser(merged);
      persist({
        accessToken: accessToken!,
        refreshToken: refreshToken!,
        user: merged,
        doctorLicense,
        isDoctor,
      });
    }
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setDoctorLicense(null);
    setIsDoctor(false);
    localStorage.removeItem("dh_auth");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        isDoctor,
        doctorLicense,
        login,
        loginWithGoogle,
        logout,
        fetchUserInfo,
        checkDoctorLicense,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
