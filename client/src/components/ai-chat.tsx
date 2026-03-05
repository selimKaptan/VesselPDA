import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Merhaba! Ben VesselPDA yapay zeka asistanıyım. Gemileriniz, seferler, proformalar veya denizcilik konularında yardımcı olabilirim. Nasıl yardımcı olabilirim?",
};

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasNewMessage(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const data = await apiRequest("POST", "/api/ai/chat", {
        messages: newMessages,
      });
      const json = await data.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: json.reply || "Yanıt alınamadı.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      toast({
        title: "Bağlantı hatası",
        description: "AI servisine ulaşılamadı, tekrar deneyin.",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setHasNewMessage(false);
  };

  return (
    <div className={cn(
      "fixed z-50 flex flex-col items-end gap-3",
      isMobile && isOpen ? "inset-0" : "bottom-6 right-6"
    )}>
      {isOpen && (
        <div
          data-testid="panel-ai-chat"
          className={cn(
            "bg-slate-900/90 backdrop-blur-md flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200",
            isMobile
              ? "w-full h-full rounded-none shadow-none border-0"
              : "w-80 h-[440px] rounded-2xl shadow-2xl border border-slate-700/60"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[#003D7A] dark:bg-[#002855] text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">VesselPDA Asistanı</p>
                <p className="text-xs text-blue-200 mt-0.5">Claude Haiku · AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {messages.map((msg, index) => (
              <div
                key={index}
                data-testid={msg.role === "assistant" ? `msg-bot-${index}` : `msg-user-${index}`}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-[#003D7A] flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "bg-sky-500/20 border border-sky-500/30 text-sky-100 rounded-br-sm"
                      : "bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start" data-testid="msg-bot-loading">
                <div className="w-6 h-6 rounded-full bg-[#003D7A] flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                data-testid="input-ai-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mesajınızı yazın..."
                className="min-h-[40px] max-h-[120px] text-sm resize-none py-2 px-3 rounded-xl"
                disabled={isLoading}
                rows={1}
              />
              <Button
                data-testid="button-ai-send"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl bg-[#003D7A] hover:bg-[#0077BE]"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Enter ile gönder · Shift+Enter satır sonu
            </p>
          </div>
        </div>
      )}

      {!(isMobile && isOpen) && (
      <button
        data-testid="button-ai-chat"
        onClick={handleOpen}
        className={cn(
          "group relative flex items-center gap-2 rounded-full shadow-lg transition-all duration-200",
          isOpen
            ? "bg-[#003D7A] px-4 py-3"
            : "bg-[#003D7A] hover:bg-[#0077BE] px-4 py-3 hover:shadow-xl hover:scale-105"
        )}
      >
        {hasNewMessage && !isOpen && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white dark:border-background" />
        )}
        <Sparkles className="w-5 h-5 text-white" />
        <span className="text-sm font-medium text-white">AI Asistan</span>
      </button>
      )}
    </div>
  );
}
