import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ScanFace,
  RotateCcw,
  BadgeCheck,
  Check,
  Lock,
  IdCard,
  Eye,
  Cake,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

type WorkflowKey = "identity" | "license";

interface DecisionCheck {
  type: string;
  status: string;
  score?: number;
  error?: { message?: string } | null;
}

interface Decision {
  status?: string;
  decision?: string;
  decided_at?: string;
  checks?: DecisionCheck[];
}

interface StepResult {
  status: string;
  decision: Decision | null;
}

interface FlowState {
  results: Partial<Record<WorkflowKey, StepResult>>;
  inFlight: { workflow: WorkflowKey; sessionId: string } | null;
}

const STORAGE_KEY = "valyd_verify_flow";
const STEPS: { key: WorkflowKey; label: string; description: string; icon: typeof ScanFace }[] = [
  {
    key: "identity",
    label: "Identity",
    description: "Scan your ID + selfie — document check, liveness and face match.",
    icon: ScanFace,
  },
  {
    key: "license",
    label: "License",
    description: "Verify a professional license by state, type and number.",
    icon: BadgeCheck,
  },
];

// The identity hosted session runs these sub-checks in one pass; each gets its
// own circle in the stepper, populated from the decision once the run finishes.
const IDENTITY_CHECKS: { type: string; label: string; icon: typeof ScanFace }[] = [
  { type: "id_verification", label: "ID", icon: IdCard },
  { type: "liveness", label: "Liveness", icon: Eye },
  { type: "face_match", label: "Face", icon: ScanFace },
  { type: "age", label: "Age", icon: Cake },
  { type: "location", label: "Location", icon: MapPin },
];

const TERMINAL = ["APPROVED", "DECLINED", "ABANDONED", "EXPIRED"];
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // ~2 minutes

const statusStyles: Record<string, { label: string; tone: "good" | "bad" | "warn" | "neutral"; icon: typeof CheckCircle2 }> = {
  APPROVED: { label: "Approved", tone: "good", icon: CheckCircle2 },
  DECLINED: { label: "Declined", tone: "bad", icon: XCircle },
  IN_REVIEW: { label: "In Review", tone: "warn", icon: Clock },
  IN_PROGRESS: { label: "In Progress", tone: "neutral", icon: Loader2 },
  NOT_STARTED: { label: "Not Started", tone: "neutral", icon: Clock },
  ABANDONED: { label: "Abandoned", tone: "warn", icon: AlertTriangle },
  EXPIRED: { label: "Expired", tone: "warn", icon: AlertTriangle },
};

const toneClasses: Record<string, string> = {
  good: "bg-accent/15 text-accent",
  bad: "bg-destructive/15 text-destructive",
  warn: "bg-warning/15 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

// Solid fills for the step circle.
const circleTone: Record<string, string> = {
  good: "bg-accent text-accent-foreground border-accent",
  bad: "bg-destructive text-destructive-foreground border-destructive",
  warn: "bg-warning text-warning-foreground border-warning",
  neutral: "bg-muted text-muted-foreground border-border",
};

function prettyType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function findCheck(decision: Decision | null | undefined, type: string): DecisionCheck | null {
  return decision?.checks?.find((c) => c.type === type) ?? null;
}

// Scores are 0–1 ratios for some checks (face match, liveness) but raw values
// for others (age in years, etc.). Only render a percentage for true ratios.
function formatScore(score?: number): string | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  if (score >= 0 && score <= 1) return `${Math.round(score * 100)}%`;
  return String(score);
}

function loadFlow(): FlowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as FlowState;
  } catch {
    // ignore corrupt state
  }
  return { results: {}, inFlight: null };
}

function inferWorkflow(decision: Decision | null, fallback: WorkflowKey): WorkflowKey {
  const types = decision?.checks?.map((c) => c.type) ?? [];
  if (types.includes("id_verification") || types.includes("face_match") || types.includes("liveness")) {
    return "identity";
  }
  if (types.includes("credential")) return "license";
  return fallback;
}

function CheckTable({ decision }: { decision: Decision | null }) {
  if (!decision?.checks?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-border overflow-hidden">
      {decision.checks.map((check, idx) => {
        const passed = check.status === "passed";
        const failed = check.status === "failed";
        const score = formatScore(check.score);
        return (
          <div
            key={`${check.type}-${idx}`}
            className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{prettyType(check.type)}</p>
              {check.error?.message && (
                <p className="text-xs text-destructive mt-0.5">{check.error.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {score && <span className="text-xs text-muted-foreground tabular-nums">{score}</span>}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  passed
                    ? "bg-accent/15 text-accent"
                    : failed
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : failed ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                {check.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function VerifySection() {
  const { user } = useAuth();
  const [flow, setFlow] = useState<FlowState>(loadFlow);
  const [polling, setPolling] = useState<{ workflow: WorkflowKey | null; sessionId: string } | null>(null);
  const [starting, setStarting] = useState<WorkflowKey | null>(null);
  const [error, setError] = useState<{ workflow: WorkflowKey; message: string } | null>(null);
  const [focusKey, setFocusKey] = useState<WorkflowKey | null>(null);
  const mountHandled = useRef(false);

  // Persist flow across the redirect round-trip.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
    } catch {
      // ignore quota/serialisation errors
    }
  }, [flow]);

  const loadDecision = useCallback(async (id: string): Promise<Decision | null> => {
    try {
      const res = await fetch(`/api/verify/session/${encodeURIComponent(id)}/decision`);
      const json = await res.json();
      if (json?.success && json?.data) return json.data as Decision;
    } catch {
      // best-effort
    }
    return null;
  }, []);

  // On return from the hosted page Valyd redirects to /dashboard?session_id=…&status=…
  useEffect(() => {
    if (mountHandled.current) return;
    mountHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const returnedId = params.get("session_id");
    const initial = loadFlow();

    if (returnedId) {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }

    const sessionId = returnedId || initial.inFlight?.sessionId || null;
    if (!sessionId) return;

    const workflow =
      initial.inFlight?.sessionId === sessionId ? initial.inFlight.workflow : initial.inFlight?.workflow ?? null;
    setPolling({ workflow, sessionId });
  }, []);

  // Poll the in-flight session until it reaches a terminal state.
  useEffect(() => {
    if (!polling) return;
    const { sessionId } = polling;

    let attempts = 0;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const finish = async (status: string) => {
      active = false;
      let decision: Decision | null = null;
      if (status === "APPROVED" || status === "DECLINED") {
        decision = await loadDecision(sessionId);
      }
      const workflow = polling.workflow ?? inferWorkflow(decision, "identity");
      setFlow((prev) => ({
        results: { ...prev.results, [workflow]: { status, decision } },
        inFlight: null,
      }));
      // Clear the manual focus so the detail panel auto-advances to the next
      // actionable step (e.g. License unlocks once Identity is approved).
      setFocusKey(null);
      setPolling(null);
      // Tell the activity list to refresh so this verification shows up.
      window.dispatchEvent(new CustomEvent("valyd-verify-updated"));
    };

    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/verify/session/${encodeURIComponent(sessionId)}`);
        const json = await res.json();
        const current: string | undefined = json?.data?.status;
        if (current && TERMINAL.includes(current)) {
          await finish(current);
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (attempts >= MAX_POLLS) {
        await finish("IN_PROGRESS");
        return;
      }
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [polling, loadDecision]);

  const startVerification = useCallback(
    async (workflow: WorkflowKey) => {
      setStarting(workflow);
      setError(null);
      try {
        const res = await fetch("/api/verify/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow, vendor_data: user?.id ? String(user.id) : undefined }),
        });
        const json = await res.json();
        if (json?.success && json?.data?.url) {
          const next: FlowState = { ...flow, inFlight: { workflow, sessionId: json.data.session_id } };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          window.location.href = json.data.url;
          return;
        }
        setError({ workflow, message: json?.error?.message || "Could not start verification. Please try again." });
        setStarting(null);
      } catch {
        setError({ workflow, message: "Network error while starting verification." });
        setStarting(null);
      }
    },
    [user?.id, flow],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setFlow({ results: {}, inFlight: null });
    setPolling(null);
    setStarting(null);
    setError(null);
    setFocusKey(null);
  }, []);

  // Derive per-step state.
  const stepStates = STEPS.map((step, idx) => {
    const result = flow.results[step.key];
    const isDone = Boolean(result);
    const isApproved = result?.status === "APPROVED";
    const prevResult = idx === 0 ? null : flow.results[STEPS[idx - 1].key];
    const prevApproved = idx === 0 || prevResult?.status === "APPROVED";
    const isPolling =
      polling?.workflow === step.key || (!!polling && polling.workflow === null && !isDone && prevApproved);
    const isActive = prevApproved && !isDone && !isPolling;
    const isLocked = !prevApproved && !isDone;
    const badge = result?.status ? statusStyles[result.status] ?? statusStyles.NOT_STARTED : null;
    return { step, idx, result, isDone, isApproved, prevResult, prevApproved, isPolling, isActive, isLocked, badge };
  });
  const idState = stepStates[0];
  const licState = stepStates[1];

  // Which step's detail to show below the stepper.
  const defaultFocusIdx = (() => {
    const pol = stepStates.findIndex((s) => s.isPolling);
    if (pol >= 0) return pol;
    const act = stepStates.findIndex((s) => s.isActive);
    if (act >= 0) return act;
    for (let i = stepStates.length - 1; i >= 0; i--) if (stepStates[i].isDone) return i;
    return 0;
  })();
  const focusIdx = focusKey ? STEPS.findIndex((s) => s.key === focusKey) : defaultFocusIdx;
  const focus = stepStates[focusIdx] ?? stepStates[0];
  const focusError = error?.workflow === focus.step.key ? error.message : null;

  const completedCount = stepStates.filter((s) => s.isDone).length;
  const anyProgress = completedCount > 0 || polling !== null || starting !== null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Identity Verification
          </h3>

          <div className="rounded-2xl bg-card border border-border shadow-lg p-6 sm:p-8">
            <div className="mb-7 text-center">
              <h4 className="text-lg font-heading font-bold text-foreground">Verify with Valyd</h4>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                Complete each step in order on Valyd's secure hosted page. You'll return here and we
                fetch the result automatically.
              </p>
            </div>

            {/* Horizontal stepper — Identity expands into its sub-checks, then License */}
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start justify-center min-w-[480px] px-2">
                {IDENTITY_CHECKS.map((c, i) => {
                  const check = idState.isDone ? findCheck(idState.result?.decision, c.type) : null;
                  // Resolve this sub-check's visual mode.
                  let circleClass = "bg-muted text-muted-foreground border-border";
                  let icon = <c.icon className="h-5 w-5" />;
                  if (idState.isPolling) {
                    circleClass = "bg-primary text-primary-foreground border-primary";
                    icon = <Loader2 className="h-5 w-5 animate-spin" />;
                  } else if (idState.isDone) {
                    if (check?.status === "passed") {
                      circleClass = circleTone.good;
                      icon = <Check className="h-5 w-5" />;
                    } else if (check?.status === "failed") {
                      circleClass = circleTone.bad;
                      icon = <XCircle className="h-5 w-5" />;
                    } else if (check) {
                      circleClass = circleTone.warn;
                      icon = <Clock className="h-5 w-5" />;
                    }
                  } else if (idState.isActive) {
                    circleClass = "bg-primary/5 text-primary border-primary/40";
                  }

                  // Connector after this node: green within identity when this
                  // sub-check passed; the last one leads to License (green when
                  // identity is approved overall).
                  const isLastIdentity = i === IDENTITY_CHECKS.length - 1;
                  const connectorGreen = isLastIdentity
                    ? idState.isApproved
                    : idState.isDone && check?.status === "passed";

                  return (
                    <Fragment key={c.type}>
                      <button
                        type="button"
                        onClick={() => setFocusKey("identity")}
                        className="flex flex-col items-center gap-2 w-16 shrink-0 text-center cursor-pointer"
                      >
                        <span
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${circleClass} ${
                            focusIdx === 0 ? "ring-4 ring-primary/10" : ""
                          }`}
                        >
                          {icon}
                        </span>
                        <span className="text-[11px] font-semibold leading-tight text-foreground">{c.label}</span>
                      </button>
                      <span
                        className={`flex-1 h-0.5 mt-[19px] min-w-[12px] rounded-full transition-colors ${
                          connectorGreen ? "bg-accent" : "bg-border"
                        }`}
                        aria-hidden
                      />
                    </Fragment>
                  );
                })}

                {/* License step */}
                {(() => {
                  const s = licState;
                  const clickable = s.isDone || s.isActive || s.isPolling;
                  let circleClass = "bg-muted text-muted-foreground border-border";
                  let icon = <BadgeCheck className="h-5 w-5" />;
                  if (s.isPolling) {
                    circleClass = "bg-primary text-primary-foreground border-primary";
                    icon = <Loader2 className="h-5 w-5 animate-spin" />;
                  } else if (s.isDone) {
                    circleClass = circleTone[s.badge?.tone ?? "neutral"];
                    icon = s.isApproved ? <Check className="h-5 w-5" /> : s.badge ? <s.badge.icon className="h-5 w-5" /> : icon;
                  } else if (s.isActive) {
                    circleClass = "bg-primary text-primary-foreground border-primary";
                  } else if (s.isLocked) {
                    icon = <Lock className="h-4 w-4" />;
                  }

                  return (
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && setFocusKey("license")}
                      className={`flex flex-col items-center gap-2 w-16 shrink-0 text-center ${clickable ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${circleClass} ${
                          focusIdx === 1 && clickable ? "ring-4 ring-primary/15" : ""
                        }`}
                      >
                        {icon}
                      </span>
                      <span
                        className={`text-[11px] font-semibold leading-tight ${
                          s.isLocked ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        License
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Detail panel for the focused step */}
            <div className="mt-7 pt-6 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <h5 className="text-base font-heading font-bold text-foreground">{focus.step.label} Verification</h5>
                {focus.badge && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[focus.badge.tone]}`}
                  >
                    <focus.badge.icon className="h-3.5 w-3.5" />
                    {focus.badge.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{focus.step.description}</p>

              {/* Polling */}
              {focus.isPolling && (
                <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <p className="text-xs text-muted-foreground">Checking your result…</p>
                </div>
              )}

              {/* Active → start / continue */}
              {focus.isActive && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => startVerification(focus.step.key)}
                    disabled={starting !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
                  >
                    {starting === focus.step.key ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting…
                      </>
                    ) : (
                      <>
                        {focus.idx === 0 ? "Start Verification" : "Continue"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  {focusError && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground">{focusError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Locked */}
              {focus.isLocked && (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <Lock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">
                    {focus.prevResult
                      ? `“${STEPS[focus.idx - 1].label}” must be approved before this step unlocks.`
                      : `Approve “${STEPS[focus.idx - 1].label}” first to unlock this step.`}
                  </p>
                </div>
              )}

              {/* Done → checks */}
              {focus.isDone && <CheckTable decision={focus.result!.decision} />}
            </div>

            {anyProgress && (
              <div className="mt-6 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                  Start Over
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
