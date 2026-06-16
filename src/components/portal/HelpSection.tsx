import { motion } from "framer-motion";
import { LifeBuoy, BookOpen, Phone, MessageSquare } from "lucide-react";

const helpItems = [
  { icon: BookOpen, title: "Knowledge Base", description: "Browse guides and documentation for common tasks." },
  { icon: MessageSquare, title: "Live Chat", description: "Reach our support team in real-time during business hours." },
  { icon: Phone, title: "Phone Support", description: "Call us at 1-800-POLLUS for immediate assistance." },
  { icon: LifeBuoy, title: "Submit a Ticket", description: "Create a support ticket and we'll respond within 24 hours." },
];

const HelpSection = () => (
  <section className="py-16 md:py-20 bg-muted/40">
    <div className="container mx-auto px-4 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground mb-3">
          Help & Support
        </span>
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
          We're Here to Help
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {helpItems.map((h, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="rounded-xl bg-card border border-border p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 mb-3">
              <h.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-heading font-semibold text-foreground">{h.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{h.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HelpSection;
