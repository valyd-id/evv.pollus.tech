import { motion } from "framer-motion";
import {
  User,
  BadgeCheck,
  Mail,
  Calendar,
  IdCard,
  LogOut,
  Stethoscope,
  Shield,
  Hash,
  Globe,
  AlertTriangle,
  ExternalLink,
  MapPin,
  Clock,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import AnnouncementsSection from "@/components/portal/AnnouncementsSection";
import HelpSection from "@/components/portal/HelpSection";
import FAQSection from "@/components/portal/FAQSection";
import PortalFooter from "@/components/portal/PortalFooter";
import LoginHistorySection from "@/components/portal/LoginHistorySection";
import { useState } from "react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Dashboard = () => {
  const { user, isDoctor, doctorLicense, logout, checkDoctorLicense } = useAuth();
  const navigate = useNavigate();
  const [isRefreshingDoctorStatus, setIsRefreshingDoctorStatus] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function handleRefreshDoctorStatus() {
    setIsRefreshingDoctorStatus(true);
    try {
      await checkDoctorLicense();
    } finally {
      setIsRefreshingDoctorStatus(false);
    }
  }

  const displayName =
    user?.full_name ||
    user?.name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.email ||
    "User";

  const profileFields = [
    { icon: Mail, label: "Email", value: user?.email || "—" },
    { icon: User, label: "Username", value: user?.username || "—" },
    { icon: Hash, label: "Pollus ID", value: user?.pollus_id || String(user?.id || "—") },
    { icon: Globe, label: "Country", value: user?.country || "—" },
    {
      icon: Calendar,
      label: "Member Since",
      value: user?.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—",
    },
    {
      icon: Shield,
      label: "ID Verified",
      value: user?.id_verified ? "Verified" : "Not Verified",
      isStatus: true,
      verified: user?.id_verified,
    },
  ];

  const fmt = doctorLicense?.meta?.formatted;

  const licenseFields = doctorLicense
    ? [
        {
          icon: Stethoscope,
          label: "License Type",
          value: (fmt?.license_type || doctorLicense.license_type || "—").replace(/_/g, " "),
        },
        { icon: IdCard, label: "License Number", value: fmt?.license_number || doctorLicense.external_ref || "—" },
        {
          icon: Shield,
          label: "Status",
          value: fmt?.status || (doctorLicense.verified ? "Verified" : "Unverified"),
          isStatus: true,
          verified: doctorLicense.verified || fmt?.status === "Active",
        },
        {
          icon: FileCheck,
          label: "Verified From",
          value: fmt?.verified_from || doctorLicense.verified_from || "—",
        },
        {
          icon: MapPin,
          label: "State",
          value: fmt?.state || "—",
        },
        {
          icon: Calendar,
          label: "Expiration Date",
          value: fmt?.expiration_date
            ? new Date(fmt.expiration_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : doctorLicense.expire_at
              ? new Date(doctorLicense.expire_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
              : "—",
        },
        {
          icon: Clock,
          label: "Last Checked",
          value: doctorLicense.checked_at
            ? new Date(doctorLicense.checked_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : "—",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 glass-card border-b"
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-3 md:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-heading font-bold text-foreground tracking-tight">
              Valyd<span className="text-primary">Health</span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="flex-1">
        <div className="py-10 md:py-16">
          <div className="container mx-auto px-4">
            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={handleRefreshDoctorStatus}
                  disabled={isRefreshingDoctorStatus}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-60 transition-all"
                  title="Refresh doctor status"
                  aria-label="Refresh doctor status"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingDoctorStatus ? "animate-spin" : ""}`} />
                </button>
              </div>
              <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground mb-3">
                Dashboard
              </span>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                Welcome, {displayName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Your profile and license information.
              </p>
            </motion.div>

            {/* Not a doctor alert */}
            {!isDoctor && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="max-w-3xl mx-auto mb-8"
              >
                <div className="rounded-2xl border-2 border-warning/30 bg-warning/5 p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 shrink-0">
                      <AlertTriangle className="h-6 w-6 text-warning" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-heading font-bold text-foreground">
                        Doctor License Not Found
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                        We couldn't find a doctor license associated with your account. To access
                        the full Doctor Portal features, you need to add and verify your medical
                        license through the ValydHealth Identity Dashboard.
                      </p>
                      <a
                        href={import.meta.env.VITE_VALYD_BASE_URL + "/dashboard"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-warning px-5 py-2.5 text-sm font-semibold text-warning-foreground shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        Add Your License
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Profile card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="max-w-3xl mx-auto rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8 mb-8"
            >
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  {user?.avatar_url || user?.face_image_url ? (
                    <img
                      src={(user.avatar_url || user.face_image_url)!}
                      alt="avatar"
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-xl font-heading font-bold text-foreground">
                    {displayName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {user?.email || user?.username || ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isDoctor && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Licensed Doctor
                      </span>
                    )}
                    {user?.id_verified && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1 text-xs font-semibold text-info">
                        <Shield className="h-3.5 w-3.5" />
                        ID Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Profile info grid */}
            <div className="max-w-3xl mx-auto mb-10">
              <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Profile Information
              </h3>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                {profileFields.map(({ icon: Icon, label, value, isStatus, verified }) => (
                  <motion.div
                    key={label}
                    variants={item}
                    className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {label}
                      </p>
                      {isStatus ? (
                        <span
                          className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                            verified ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              verified ? "bg-accent" : "bg-warning"
                            }`}
                          />
                          {value}
                        </span>
                      ) : (
                        <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
                          {value}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* License info grid (doctor or most matching license) */}
            {doctorLicense && (
              <div className="max-w-3xl mx-auto mb-4">
                <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {isDoctor ? "Doctor License" : "Most Matching License"}
                </h3>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {licenseFields.map(({ icon: Icon, label, value, isStatus, verified }) => (
                    <motion.div
                      key={label}
                      variants={item}
                      className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                        <Icon className="h-4.5 w-4.5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {label}
                        </p>
                        {isStatus ? (
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                              verified
                                ? "bg-accent/15 text-accent"
                                : "bg-warning/15 text-warning"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                verified ? "bg-accent" : "bg-warning"
                              }`}
                            />
                            {value}
                          </span>
                        ) : (
                          <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
                            {value}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Login Activity */}
        <LoginHistorySection />

        {/* Shared sections for all users */}
        <AnnouncementsSection />
        <HelpSection />
        <FAQSection />
      </main>

      <PortalFooter />
    </div>
  );
};

export default Dashboard;
