import { motion } from "framer-motion";
import { ShieldCheck, Clock, Lock } from "lucide-react";

const features = [
  { icon: ShieldCheck, label: "Verified & Secure" },
  { icon: Clock, label: "24/7 Access" },
  { icon: Lock, label: "HIPAA Compliant" },
];

const HeroSection = () => (
  <section id="home" className="relative overflow-hidden py-16 md:py-24">
    {/* Gradient blob */}
    <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
    <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

    <div className="container mx-auto px-4 text-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-block rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold text-secondary-foreground mb-6">
          Doctor Portal — Phase 1 Preview
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-foreground leading-tight max-w-3xl mx-auto">
          Your Professional
          <br />
          <span className="text-primary">Medical Dashboard</span>
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Access your license details, stay updated with announcements, and manage your professional profile — all in one secure portal.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-10 flex flex-wrap items-center justify-center gap-6"
      >
        {features.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4 text-accent" />
            <span>{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
