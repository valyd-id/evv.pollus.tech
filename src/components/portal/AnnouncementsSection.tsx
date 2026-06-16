import { motion } from "framer-motion";
import { Megaphone, Bell, AlertTriangle } from "lucide-react";

const announcements = [
  {
    icon: Megaphone,
    title: "Annual License Renewal Open",
    description: "The 2026 renewal window is now open. Please submit your documents before November 30, 2026.",
    date: "April 10, 2026",
    type: "info" as const,
  },
  {
    icon: AlertTriangle,
    title: "System Maintenance — April 20",
    description: "The portal will be briefly unavailable from 2:00 AM to 4:00 AM EST for scheduled maintenance.",
    date: "April 8, 2026",
    type: "warning" as const,
  },
  {
    icon: Bell,
    title: "New CME Requirements Published",
    description: "Updated continuing medical education requirements have been posted. Review the changes in your dashboard.",
    date: "April 5, 2026",
    type: "info" as const,
  },
];

const typeStyles = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

const AnnouncementsSection = () => (
  <section id="announcements" className="py-16 md:py-20">
    <div className="container mx-auto px-4 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground mb-3">
          Announcements
        </span>
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          Latest Updates & Notices
        </h2>
      </motion.div>

      <div className="space-y-4">
        {announcements.map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="rounded-xl bg-card border border-border p-5 flex gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${typeStyles[a.type]}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-heading font-semibold text-foreground">{a.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{a.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{a.date}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default AnnouncementsSection;
