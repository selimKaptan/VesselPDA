import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Circle, ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingStep {
  id: string;
  label: string;
  href: string;
}

interface OnboardingProgress {
  completedSteps: string[];
  allSteps: OnboardingStep[];
  percentage: number;
}

export function GettingStartedWidget() {
  const { data, isLoading } = useQuery<OnboardingProgress>({
    queryKey: ["/api/users/onboarding-progress"],
  });

  if (isLoading || !data) return null;

  const isCompleted = data.percentage === 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="mb-6"
      >
        <Card className="p-5 border-sky-500/20 bg-sky-500/[0.02] dark:bg-sky-500/[0.05] relative overflow-hidden group">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-500" />
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-serif flex items-center gap-2">
                  {isCompleted ? (
                    <>
                      <Trophy className="w-5 h-5 text-amber-500" />
                      You're all set!
                    </>
                  ) : (
                    "Getting Started"
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isCompleted 
                    ? "You've completed all onboarding steps. Great job!" 
                    : `${data.completedSteps.length} of ${data.allSteps.length} steps completed`}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{data.percentage}%</span>
              </div>
            </div>

            <Progress value={data.percentage} className="h-2 bg-sky-100 dark:bg-sky-900/30" indicatorClassName="bg-sky-500" />

            {!isCompleted && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {data.allSteps.map((step) => {
                  const isDone = data.completedSteps.includes(step.id);
                  return (
                    <Link key={step.id} href={step.href}>
                      <div 
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover-elevate ${
                          isDone 
                            ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30 opacity-70" 
                            : "bg-white dark:bg-black/20 border-border hover:border-sky-500/50"
                        }`}
                        data-testid={`onboarding-step-${step.id}`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${isDone ? "text-emerald-800 dark:text-emerald-400 line-through" : ""}`}>
                          {step.label}
                        </span>
                        <ChevronRight className={`w-4 h-4 ml-auto ${isDone ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {isCompleted && (
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // We could mark it as dismissed in localStorage or DB
                    // For now, let it be visible for a while or maybe we add a close button
                  }}
                  className="text-xs"
                >
                  Dismiss Checklist
                </Button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
