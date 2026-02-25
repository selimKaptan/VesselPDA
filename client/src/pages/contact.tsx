import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ship, ArrowLeft, CheckCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

const contactSchema = z.object({
  name: z.string().min(2, "Ad Soyad en az 2 karakter olmalı"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  subject: z.string().min(3, "Konu en az 3 karakter olmalı"),
  message: z.string().min(10, "Mesaj en az 10 karakter olmalı"),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const onSubmit = async (data: ContactForm) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/contact", data);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.05)] via-background to-[hsl(var(--maritime-accent)/0.04)]">
      {/* Minimal nav */}
      <nav className="border-b bg-background/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5" data-testid="link-logo-home">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-7 h-7 rounded-md object-contain" />
            <span className="font-serif font-bold text-base tracking-tight">VesselPDA</span>
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfa
          </a>
        </div>
      </nav>

      {/* Page header */}
      <div className="bg-gradient-to-br from-[hsl(var(--maritime-primary))] via-[hsl(var(--maritime-secondary))] to-[hsl(var(--maritime-primary)/0.85)] py-12 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 mb-1">
            <Ship className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight">
            Bizimle İletişime Geçin
          </h1>
          <p className="text-white/75 text-sm md:text-base max-w-md mx-auto">
            Sorularınız, önerileriniz veya işbirliği talepleriniz için mesaj gönderin.
          </p>
        </div>
      </div>

      {/* Form / Success card */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {submitted ? (
          <Card className="p-10 text-center shadow-md border-[hsl(var(--maritime-primary)/0.15)]" data-testid="contact-success">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 border border-green-200 mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-serif text-2xl font-bold mb-2 text-foreground">Mesajınız İletildi</h2>
            <p className="text-muted-foreground mb-6">
              Ekibimiz en kısa sürede size geri dönüş yapacaktır.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/">
                <Button variant="outline" data-testid="button-back-home">Ana Sayfaya Dön</Button>
              </a>
              <Button
                onClick={() => { setSubmitted(false); form.reset(); }}
                data-testid="button-send-another"
              >
                Yeni Mesaj Gönder
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8 shadow-md border-[hsl(var(--maritime-primary)/0.15)]" data-testid="contact-form-card">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="contact-form">

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Ad Soyad <span className="text-destructive">*</span></Label>
                  <Input
                    id="contact-name"
                    placeholder="Ahmet Yılmaz"
                    {...form.register("name")}
                    data-testid="input-contact-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive" data-testid="error-contact-name">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">E-posta <span className="text-destructive">*</span></Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="ahmet@sirket.com"
                    {...form.register("email")}
                    data-testid="input-contact-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive" data-testid="error-contact-email">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-subject">Konu <span className="text-destructive">*</span></Label>
                <Input
                  id="contact-subject"
                  placeholder="Mesajınızın konusu..."
                  {...form.register("subject")}
                  data-testid="input-contact-subject"
                />
                {form.formState.errors.subject && (
                  <p className="text-xs text-destructive" data-testid="error-contact-subject">
                    {form.formState.errors.subject.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-message">Mesaj <span className="text-destructive">*</span></Label>
                <Textarea
                  id="contact-message"
                  placeholder="Mesajınızı buraya yazın..."
                  rows={6}
                  {...form.register("message")}
                  data-testid="input-contact-message"
                />
                {form.formState.errors.message && (
                  <p className="text-xs text-destructive" data-testid="error-contact-message">
                    {form.formState.errors.message.message}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg" data-testid="error-contact-general">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={submitting}
                data-testid="button-submit-contact"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Gönder
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Mesajınız <strong>info@vesselpda.com</strong> adresine iletilecektir.
              </p>
            </form>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VesselPDA · <a href="https://vesselpda.com" className="hover:text-foreground transition-colors">vesselpda.com</a>
      </footer>
    </div>
  );
}
