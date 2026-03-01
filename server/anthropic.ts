import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function handleAiChat(
  userId: string,
  messages: ChatMessage[]
): Promise<{ reply: string; tokensUsed: number }> {
  const user = await storage.getUser(userId);
  const firstName = user?.firstName || user?.email?.split("@")[0] || "Kullanıcı";
  const userRole = user?.userRole || "user";

  const vessels = await storage.getVesselsByUser(userId);
  const vesselList =
    vessels.length > 0
      ? vessels
          .slice(0, 10)
          .map((v) => `${v.name} (${v.vesselType || "Gemi"}, GRT: ${v.grossTonnage || "?"}, Bayrak: ${v.flag || "?"})`)
          .join("; ")
      : "Kayıtlı gemi yok";

  let voyageList = "Aktif sefer yok";
  try {
    const voyages = await storage.getVoyagesByUser(userId, userRole);
    const active = voyages.filter((v: any) => v.status === "active").slice(0, 5);
    if (active.length > 0) {
      voyageList = active
        .map(
          (v: any) =>
            `Sefer #${v.id}: ${v.vesselName || "?"} → ${v.portName || v.portId} (ETA: ${v.eta ? new Date(v.eta).toLocaleDateString("tr-TR") : "?"})`
        )
        .join("; ");
    }
  } catch {}

  let proformaList = "Son proforma yok";
  try {
    const proformas = await storage.getProformasByUser(userId);
    const recent = proformas.slice(0, 3);
    if (recent.length > 0) {
      proformaList = recent
        .map(
          (p: any) =>
            `${p.referenceNumber || `#${p.id}`}: ${p.vesselName || "?"} / ${p.portName || "?"} — $${p.totalUsd ? Number(p.totalUsd).toLocaleString() : "?"}`
        )
        .join("; ");
    }
  } catch {}

  const roleLabel: Record<string, string> = {
    admin: "Platform Yöneticisi",
    shipowner: "Gemi Armatörü/Broker",
    agent: "Gemi Acentesi",
    provider: "Hizmet Sağlayıcı",
  };

  const systemPrompt = `Sen VesselPDA denizcilik platformunun yapay zeka asistanısın. Platform; proforma disbursement hesaplama, liman bilgileri, denizcilik dizini, sefer yönetimi ve ihale sistemlerini kapsar.

Kullanıcı: ${firstName} (${roleLabel[userRole] || userRole})
Kayıtlı Gemiler: ${vesselList}
Aktif Seferleri: ${voyageList}
Son Proformaları: ${proformaList}

Görevlerin:
- Denizcilik soruları (proforma kalemleri, liman gereksinimleri, belgeler, TBGM/DTO tarifeleri)
- Kullanıcının proformalarını yorumlama ve açıklama
- Platform kullanımı hakkında yardım (nasıl proforma oluştururum, ihale nasıl veririm, vb.)
- Genel denizcilik bilgisi (IMO kuralları, MARPOL, SOLAS, liman prosedürleri)

Kurallar:
- Kullanıcı Türkçe yazarsa Türkçe, İngilizce yazarsa İngilizce cevap ver
- Kısa ve öz ol, gerektiğinde madde madde açıkla
- Bilmediğin spesifik tarife veya fiyat varsa "güncel veriler için ilgili birime danışın" de
- Platformdaki işlemleri teşvik et (proforma oluştur, sefer başlat, ihale ver vb.)`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  const reply =
    response.content[0]?.type === "text" ? response.content[0].text : "Bir hata oluştu.";

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  return { reply, tokensUsed };
}
