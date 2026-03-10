import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; variant?: "default" | "outline" };
  secondaryAction?: { label: string; onClick: () => void };
  compact?: boolean;
  testId?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
  testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14")}
      data-testid={testId}
    >
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center">
          <Icon className="w-8 h-8 text-slate-600" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center">
          <Plus className="w-3 h-3 text-slate-500" />
        </div>
      </div>
      <h4 className="text-sm font-medium text-slate-300 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-[280px] mb-4">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && (
            <Button
              size="sm"
              variant={action.variant || "default"}
              onClick={action.onClick}
              className="text-xs h-8 px-3"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant="ghost"
              onClick={secondaryAction.onClick}
              className="text-xs h-8 px-3 text-slate-400"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
