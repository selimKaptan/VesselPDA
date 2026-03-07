import { useState } from "react";
import { 
  FileDown, 
  Trash2, 
  CheckCircle2, 
  Bell, 
  X, 
  ChevronRight,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-csv";

interface FloatingBulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: {
    label: string;
    icon: any;
    onClick: () => void;
    variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
    disabled?: boolean;
    isLoading?: boolean;
  }[];
}

export function FloatingBulkActionBar({ selectedCount, onClear, actions }: FloatingBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300" data-testid="floating-bulk-bar">
      <Card className="bg-slate-900 border-slate-800 shadow-2xl p-2 sm:p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 pl-2">
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
            {selectedCount}
          </div>
          <span className="text-sm font-medium text-slate-200 hidden sm:inline" data-testid="text-bulk-selected-count">
            {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              size="sm"
              variant={action.variant || "outline"}
              onClick={action.onClick}
              disabled={action.disabled || action.isLoading}
              className={`h-8 text-xs gap-1.5 ${
                !action.variant || action.variant === "outline" 
                  ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white" 
                  : ""
              }`}
            >
              {action.isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <action.icon className="w-3.5 h-3.5" />
              )}
              <span className="hidden xs:inline">{action.label}</span>
            </Button>
          ))}
          
          <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block" />
          
          <Button
            size="icon"
            variant="ghost"
            onClick={onClear}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
