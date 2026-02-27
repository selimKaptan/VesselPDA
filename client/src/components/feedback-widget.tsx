import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquarePlus, X, Send, Bug, Lightbulb, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const CATEGORIES = [
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-red-500" },
  { value: "feature", label: "Feature Request", icon: Lightbulb, color: "text-amber-500" },
  { value: "other", label: "Other", icon: MessageCircle, color: "text-blue-500" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const [location] = useLocation();

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/feedback", { category, message, pageUrl: location }),
    onSuccess: () => {
      toast({ title: "Feedback sent", description: "Thank you for your feedback!" });
      setMessage("");
      setCategory("bug");
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send feedback. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          className="w-80 rounded-2xl shadow-2xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: "0 8px 32px rgba(0,61,122,0.18)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(135deg, #003D7A, #0077BE)" }}
          >
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Send Feedback</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              data-testid="button-close-feedback"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  data-testid={`button-category-${cat.value}`}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all border ${
                    category === cat.value
                      ? "border-[hsl(var(--maritime-primary)/0.5)] bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))]"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <cat.icon className={`w-4 h-4 ${category === cat.value ? "text-[hsl(var(--maritime-primary))]" : cat.color}`} />
                  {cat.label}
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Describe the issue or your suggestion..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none text-sm min-h-[90px]"
              data-testid="input-feedback-message"
            />

            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending || !message.trim()}
              className="w-full gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white"
              size="sm"
              data-testid="button-submit-feedback"
            >
              <Send className="w-3.5 h-3.5" />
              {mutation.isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="button-open-feedback"
        className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-white text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
        style={{ background: "linear-gradient(135deg, #003D7A, #0077BE)" }}
      >
        {open ? <X className="w-4 h-4" /> : <MessageSquarePlus className="w-4 h-4" />}
        {!open && "Feedback"}
      </button>
    </div>
  );
}
