import { createContext, useContext, useState } from "react";

export type Lang = "en" | "tr";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.vessels": "My Vessels",
    "nav.ports": "Ports",
    "nav.proformas": "Proformas",
    "nav.newProforma": "New Proforma",
    "nav.directory": "Directory",
    "nav.servicePorts": "Service Ports",
    "nav.tenders": "Tenders",
    "nav.forum": "Forum",
    "nav.vesselTrack": "Vessel Track",
    "nav.portInfo": "Port Info",
    "nav.companyProfile": "Company Profile",
    "nav.pricing": "Pricing",
    "nav.admin": "Admin Panel",
    "nav.tools": "Tools",
    "nav.maritime": "Maritime",
    "nav.platform": "Platform",
    "nav.account": "Account",
    "btn.save": "Save",
    "btn.cancel": "Cancel",
    "btn.create": "Create",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.view": "View",
    "btn.download": "Download",
    "btn.upload": "Upload",
    "btn.search": "Search",
    "btn.filter": "Filter",
    "btn.clear": "Clear",
    "btn.submit": "Submit",
    "btn.back": "Back",
    "btn.close": "Close",
    "status.open": "Open",
    "status.closed": "Closed",
    "status.pending": "Pending",
    "status.selected": "Selected",
    "status.rejected": "Rejected",
    "status.active": "Active",
    "status.expired": "Expired",
    "plan.free": "Free",
    "plan.standard": "Standard",
    "plan.unlimited": "Unlimited",
    "role.shipowner": "Shipowner / Broker",
    "role.agent": "Ship Agent",
    "role.provider": "Service Provider",
    "role.admin": "Admin",
    "dashboard.title": "Dashboard",
    "dashboard.welcome": "Welcome back",
    "dashboard.fleet": "My Fleet",
    "dashboard.proformas": "Proformas",
    "dashboard.quickActions": "Quick Actions",
    "vessels.title": "My Vessels",
    "vessels.addVessel": "Add Vessel",
    "vessels.empty": "No vessels added yet",
    "proformas.title": "Proformas",
    "proformas.create": "Create New",
    "proformas.empty": "No proformas yet",
    "tenders.title": "Port Tenders",
    "tenders.create": "Create New Tender",
    "tenders.empty": "No tenders available",
    "tenders.openTenders": "Open Tenders",
    "tenders.myBids": "My Bids",
    "tenders.active": "Active Tenders",
    "tenders.past": "Past",
    "forum.title": "Maritime Forum",
    "forum.newTopic": "New Topic",
    "directory.title": "Maritime Directory",
    "directory.search": "Search companies...",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.noData": "No data available",
    "common.signOut": "Sign Out",
  },
  tr: {
    "nav.dashboard": "Panel",
    "nav.vessels": "Gemilerim",
    "nav.ports": "Limanlar",
    "nav.proformas": "Proformalar",
    "nav.newProforma": "Yeni Proforma",
    "nav.directory": "Rehber",
    "nav.servicePorts": "Hizmet Limanları",
    "nav.tenders": "İhaleler",
    "nav.forum": "Forum",
    "nav.vesselTrack": "Gemi Takip",
    "nav.portInfo": "Liman Bilgisi",
    "nav.companyProfile": "Şirket Profili",
    "nav.pricing": "Fiyatlandırma",
    "nav.admin": "Admin Paneli",
    "nav.tools": "Araçlar",
    "nav.maritime": "Denizcilik",
    "nav.platform": "Platform",
    "nav.account": "Hesap",
    "btn.save": "Kaydet",
    "btn.cancel": "İptal",
    "btn.create": "Oluştur",
    "btn.delete": "Sil",
    "btn.edit": "Düzenle",
    "btn.view": "Görüntüle",
    "btn.download": "İndir",
    "btn.upload": "Yükle",
    "btn.search": "Ara",
    "btn.filter": "Filtrele",
    "btn.clear": "Temizle",
    "btn.submit": "Gönder",
    "btn.back": "Geri",
    "btn.close": "Kapat",
    "status.open": "Açık",
    "status.closed": "Kapalı",
    "status.pending": "Beklemede",
    "status.selected": "Seçildi",
    "status.rejected": "Reddedildi",
    "status.active": "Aktif",
    "status.expired": "Süresi Doldu",
    "plan.free": "Ücretsiz",
    "plan.standard": "Standart",
    "plan.unlimited": "Sınırsız",
    "role.shipowner": "Gemi Sahibi / Broker",
    "role.agent": "Gemi Acentesi",
    "role.provider": "Hizmet Sağlayıcı",
    "role.admin": "Admin",
    "dashboard.title": "Panel",
    "dashboard.welcome": "Tekrar hoş geldiniz",
    "dashboard.fleet": "Filom",
    "dashboard.proformas": "Proformalar",
    "dashboard.quickActions": "Hızlı İşlemler",
    "vessels.title": "Gemilerim",
    "vessels.addVessel": "Gemi Ekle",
    "vessels.empty": "Henüz gemi eklenmedi",
    "proformas.title": "Proformalar",
    "proformas.create": "Yeni Oluştur",
    "proformas.empty": "Henüz proforma yok",
    "tenders.title": "Liman İhaleleri",
    "tenders.create": "Yeni İhale Oluştur",
    "tenders.empty": "Mevcut ihale yok",
    "tenders.openTenders": "Açık İhaleler",
    "tenders.myBids": "Tekliflerim",
    "tenders.active": "Aktif İhaleler",
    "tenders.past": "Geçmiş",
    "forum.title": "Denizcilik Forumu",
    "forum.newTopic": "Yeni Konu",
    "directory.title": "Denizcilik Rehberi",
    "directory.search": "Şirket ara...",
    "common.loading": "Yükleniyor...",
    "common.error": "Bir hata oluştu",
    "common.noData": "Veri bulunamadı",
    "common.signOut": "Çıkış Yap",
  },
};

export interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("vpda-lang");
      return (stored === "tr" || stored === "en") ? stored : "en";
    } catch { return "en"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("vpda-lang", l); } catch {}
  };

  const t = (key: string): string => translations[lang][key] ?? translations.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
