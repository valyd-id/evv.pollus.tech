import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const VALYD_CLIENT_ID = import.meta.env.VITE_VALYD_CLIENT_ID;
const VALYD_CLIENT_SECRET = import.meta.env.VITE_VALYD_CLIENT_SECRET;
const VALYD_BASE_URL = import.meta.env.VITE_VALYD_BASE_URL;
const VALYD_SCOPES = "profile verifications doctor_license";

function getRedirectUrl() {
  return `${window.location.origin}/callback`;
}

export function getValydAuthUrl() {
  const redirectUrl = getRedirectUrl();
  return `${VALYD_BASE_URL}/auth?client_id=${VALYD_CLIENT_ID}&redirect_url=${redirectUrl}&scope=${encodeURIComponent(VALYD_SCOPES)}`;
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
  logout: () => void;
  fetchUserInfo: () => Promise<void>;
  checkDoctorLicense: () => Promise<void>;
}

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
    if (!accessToken || !user) return;
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

  async function fetchUserInfo() {
    if (!accessToken) return;
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
        logout,
        fetchUserInfo,
        checkDoctorLicense,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
