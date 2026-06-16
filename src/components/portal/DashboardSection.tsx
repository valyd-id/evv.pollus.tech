import { motion } from "framer-motion";
import { User, BadgeCheck, Hash, Calendar, Clock, IdCard, FileText, Activity } from "lucide-react";

const doctorData = {
  fullName: "Dr. Sarah Mitchell, MD",
  licenseType: "Medical Doctor (MD)",
  licenseNumber: "MD-2024-00781",
  expirationDate: "December 31, 2026",
  age: 38,
  pollusUserId: "PLU-49201-SM",
  issueDate: "January 15, 2022",
  status: "Active",
};

const fields = [
  { icon: User, label: "Full Name", value: doctorData.fullName },
  { icon: FileText, label: "License Type", value: doctorData.licenseType },
  { icon: Hash, label: "License Number", value: doctorData.licenseNumber },
  { icon: Calendar, label: "Expiration Date", value: doctorData.expirationDate },
  { icon: Clock, label: "Age", value: String(doctorData.age) },
  { icon: IdCard, label: "Pollus User ID", value: doctorData.pollusUserId },
  { icon: Calendar, label: "Issue Date", value: doctorData.issueDate },
  { icon: Activity, label: "Status", value: doctorData.status, isStatus: true },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const DashboardSection = () => (
  <section id="dashboard" className="py-16 md:py-20 bg-muted/40">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground mb-3">
          Dashboard
        </span>
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Doctor Profile
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Your professional license information at a glance.
        </p>
      </motion.div>

      {/* Profile header card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8 mb-8"
      >
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="text-xl font-heading font-bold text-foreground">{doctorData.fullName}</h3>
            <p className="text-sm text-muted-foreground">{doctorData.licenseType}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              <BadgeCheck className="h-3.5 w-3.5" />
              {doctorData.status}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Info grid */}
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {fields.map(({ icon: Icon, label, value, isStatus }) => (
          <motion.div
            key={label}
            variants={item}
            className="rounded-xl bg-card border border-border p-4 flex items-start gap-3.5 hover:shadow-md transition-shadow"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              {isStatus ? (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-sm font-semibold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {value}
                </span>
              ) : (
                <p className="mt-0.5 text-sm font-semibold text-foreground truncate">{value}</p>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default DashboardSection;
