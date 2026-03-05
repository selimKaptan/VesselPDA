import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  onSecondaryAction?: () => void;
  tips?: string[];
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  onSecondaryAction,
  tips,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-state">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">{description}</p>

      <div className="flex flex-wrap gap-3 justify-center">
        {actionLabel && (
          actionHref ? (
            <Link href={actionHref}>
              <Button className="bg-sky-500 hover:bg-sky-600 text-white" data-testid="empty-state-primary-action">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAction}
              className="bg-sky-500 hover:bg-sky-600 text-white"
              data-testid="empty-state-primary-action"
            >
              {actionLabel}
            </Button>
          )
        )}
        {secondaryLabel && (
          secondaryHref ? (
            <Link href={secondaryHref}>
              <Button variant="outline" data-testid="empty-state-secondary-action">
                {secondaryLabel}
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              data-testid="empty-state-secondary-action"
            >
              {secondaryLabel}
            </Button>
          )
        )}
      </div>

      {tips && tips.length > 0 && (
        <div className="mt-8 bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 max-w-md w-full">
          <p className="text-xs font-semibold text-slate-300 dark:text-slate-300 mb-2">💡 Quick Tips</p>
          <ul className="space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-sky-400 mt-0.5 flex-shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
