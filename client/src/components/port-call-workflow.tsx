import { useState } from "react";
import {
  Navigation, Check, Clock, Anchor, Ship, Package, Users, Fuel,
  FileCheck, Flag, ShieldCheck, ClipboardCheck, Navigation2,
  FileSignature, AlertTriangle, PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStepsForOperation,
  calculateDeadline,
  canSeeInternalNotes,
  canEditWorkflow,
  type WorkflowStep,
} from "@/lib/port-call-steps";

const STEP_ICONS: Record<string, React.ElementType> = {
  navigation:       Navigation,
  "file-check":     FileCheck,
  flag:             Flag,
  "shield-check":   ShieldCheck,
  anchor:           Anchor,
  ship:             Ship,
  "clipboard-check": ClipboardCheck,
  package:          Package,
  "package-check":  PackageCheck,
  users:            Users,
  fuel:             Fuel,
  "file-signature": FileSignature,
  "navigation-2":   Navigation2,
};

function StepIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STEP_ICONS[name] ?? Navigation;
  return <Icon className={className} />;
}

export interface CompletedStepData {
  completedAt: string;
  completedBy: string;
  notes?: string;
}

export interface PortCallWorkflowProps {
  voyageId: number;
  operationType: string;
  portName: string;
  userRole: string;
  completedSteps: Record<string, CompletedStepData>;
  onStepComplete: (stepKey: string, dateTime: string, notes?: string) => Promise<void>;
  onStepEdit: (stepKey: string, dateTime: string, notes?: string) => Promise<void>;
}

export function PortCallWorkflow({
  voyageId: _voyageId,
  operationType,
  portName,
  userRole,
  completedSteps,
  onStepComplete,
  onStepEdit,
}: PortCallWorkflowProps) {
  const steps = getStepsForOperation(operationType);
  const completedCount = steps.filter(s => !!completedSteps[s.key]).length;
  const totalSteps = steps.length;

  const [inputDateTime, setInputDateTime] = useState("");
  const [inputNotes, setInputNotes] = useState("");
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editDateTime, setEditDateTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showInternal = canSeeInternalNotes(userRole);
  const canEdit = canEditWorkflow(userRole);

  async function handleComplete(stepKey: string) {
    if (!inputDateTime) return;
    setSubmitting(true);
    try {
      await onStepComplete(stepKey, inputDateTime, inputNotes || undefined);
      setInputDateTime("");
      setInputNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(stepKey: string) {
    if (!editDateTime) return;
    setSubmitting(true);
    try {
      await onStepEdit(stepKey, editDateTime, editNotes || undefined);
      setEditingStep(null);
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(step: WorkflowStep) {
    const data = completedSteps[step.key];
    setEditingStep(step.key);
    setEditDateTime(data?.completedAt?.slice(0, 16) ?? "");
    setEditNotes(data?.notes ?? "");
  }

  const isAllDone = completedCount === totalSteps && totalSteps > 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 backdrop-blur-sm p-6 space-y-5"
      data-testid="card-port-call-workflow">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Live Port Call Workflow</h3>
            <p className="text-xs text-muted-foreground">{portName} · Active Operation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAllDone ? (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Step {completedCount} / {totalSteps}
              </span>
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="space-y-0">
        {steps.map((step, index) => {
          const isCompleted = !!completedSteps[step.key];
          const isPending = !isCompleted;
          const previousKey = steps[index - 1]?.key;
          const isNext = isPending && (index === 0 || !!completedSteps[previousKey]);
          const stepData = completedSteps[step.key];
          const previousStepTime = index > 0 && completedSteps[previousKey]?.completedAt
            ? new Date(completedSteps[previousKey].completedAt)
            : null;
          const deadline = calculateDeadline(step, previousStepTime);
          const isOverdue = !!deadline && new Date() > deadline && isPending;
          const isEditing = editingStep === step.key;

          return (
            <div key={step.key} className="relative flex gap-4">
              {/* Vertical line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-5 top-12 w-0.5",
                    "h-[calc(100%-12px)]",
                    isCompleted ? "bg-emerald-500/40" : "bg-slate-700/60"
                  )}
                />
              )}

              {/* Icon circle */}
              <div
                className={cn(
                  "relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 transition-all",
                  isCompleted && "bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-500/30",
                  isNext && !isCompleted && "bg-blue-500/15 text-blue-400 ring-2 ring-blue-500/30 animate-pulse",
                  isPending && !isNext && "bg-slate-800 text-slate-600",
                  isOverdue && "bg-red-500/15 text-red-400 ring-2 ring-red-500/30 animate-none",
                )}
              >
                {isCompleted
                  ? <Check className="w-4 h-4" />
                  : <StepIcon name={step.icon} className="w-4 h-4" />
                }
              </div>

              {/* Content */}
              <div className={cn("flex-1 pb-6", isPending && !isNext && "opacity-40")}>

                {/* Title row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-sm font-semibold",
                    isCompleted && "text-emerald-400",
                    isNext && !isCompleted && "text-blue-400",
                    isPending && !isNext && "text-slate-500",
                    isOverdue && "text-red-400",
                  )}>
                    {step.label}
                  </span>
                  {isCompleted && (
                    <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                      Done
                    </span>
                  )}
                  {isOverdue && showInternal && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                      Overdue
                    </span>
                  )}
                  {isNext && !isCompleted && (
                    <span className="text-[10px] text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                      Next
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>

                {/* Completed: show date + by + edit */}
                {isCompleted && stepData && !isEditing && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-slate-400">
                      ✅{" "}
                      {new Date(stepData.completedAt).toLocaleDateString("tr-TR")}{" "}
                      {new Date(stepData.completedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-slate-500">by {stepData.completedBy}</span>
                    {stepData.notes && (
                      <span className="text-[10px] text-slate-500 italic truncate max-w-[200px]">
                        · {stepData.notes}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => openEdit(step)}
                        className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors ml-auto"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <input
                      type="datetime-local"
                      value={editDateTime}
                      onChange={e => setEditDateTime(e.target.value)}
                      className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Update notes..."
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      className="flex-1 min-w-0 text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/50 outline-none"
                    />
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEdit(step.key)}
                        disabled={!editDateTime || submitting}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => setEditingStep(null)}
                        className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Active step: confirm form */}
                {isNext && canEdit && !editingStep && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <input
                      type="datetime-local"
                      value={inputDateTime}
                      onChange={e => setInputDateTime(e.target.value)}
                      className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={inputNotes}
                      onChange={e => setInputNotes(e.target.value)}
                      className="flex-1 min-w-0 text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                    <button
                      onClick={() => handleComplete(step.key)}
                      disabled={!inputDateTime || submitting}
                      className="text-sm font-medium px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      data-testid={`button-workflow-confirm-${step.key}`}
                    >
                      {submitting ? "Saving…" : "Confirm ✓"}
                    </button>
                  </div>
                )}

                {/* Deadline warning — internal only */}
                {step.hasDeadline && deadline && isPending && showInternal && (
                  <div className={cn(
                    "mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                    isOverdue
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                  )}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">
                        {isOverdue ? "OVERDUE" : "DEADLINE"}:
                      </span>
                      {" "}
                      Must complete before{" "}
                      {deadline.toLocaleDateString("tr-TR")}{" "}
                      {deadline.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {isOverdue && (
                        <span className="ml-1 text-red-300">
                          ({Math.floor((Date.now() - deadline.getTime()) / 3_600_000)}h overdue)
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 shrink-0">
                      👁️ Internal
                    </span>
                  </div>
                )}

                {/* Internal note — only for eligible roles */}
                {step.internalNote && isPending && showInternal && (
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <span className="text-[10px] text-slate-600 italic">💡 {step.internalNote}</span>
                    <span className="text-[9px] text-slate-700 border border-slate-800 rounded px-1 py-0.5 shrink-0">
                      Internal
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PortCallWorkflow;
