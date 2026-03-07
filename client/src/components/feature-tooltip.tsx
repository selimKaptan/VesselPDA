import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";

interface FeatureTooltipProps {
  id: string;
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function FeatureTooltip({
  id,
  content,
  children,
  position = "top",
  delay = 1000,
}: FeatureTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem(`seen-tooltip-${id}`);
    if (!seen) {
      setDismissed(false);
      const timer = setTimeout(() => {
        setVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [id, delay]);

  const handleDismiss = () => {
    localStorage.setItem(`seen-tooltip-${id}`, "true");
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
  };

  if (dismissed) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip open={visible}>
        <TooltipTrigger asChild>
          <div className="relative">
            {children}
            {visible && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-sky-500 rounded-full border-2 border-white dark:border-slate-900 z-50 animate-pulse"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side={position}
          className="p-3 max-w-[240px] border-sky-500/20 bg-white dark:bg-slate-900 shadow-xl"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sky-500">
                <Info className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Quick Tip</span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm leading-relaxed">{content}</p>
            <div className="flex justify-end">
              <button
                onClick={handleDismiss}
                className="text-[10px] font-bold text-sky-500 hover:text-sky-600 uppercase tracking-widest"
              >
                Got it
              </button>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
