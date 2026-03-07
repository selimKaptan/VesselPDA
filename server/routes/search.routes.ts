import { Router } from "express";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { cached } from "../cache";
import { storage } from "../storage";
import { ilike, or, and, eq } from "drizzle-orm";
import { vessels, ports, proformas, portTenders, voyages, forumTopics, invoices, fdaAccounts } from "@shared/schema";
import { companyProfiles } from "@shared/models/auth";

const router = Router();

router.get("/api/search", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const rawQuery = (req.query.q as string || "").trim().replace(/<[^>]*>/g, "");
    if (!rawQuery || rawQuery.length < 2) return res.json({ results: [] });

    const userId = req.user?.claims?.sub || req.user?.id;
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const searchTerm = `%${rawQuery}%`;

    const cacheKey = `search:${userId}:${rawQuery.toLowerCase()}`;

    const results = await cached(cacheKey, "short", async () => {
      const [
        vesselResults,
        portResults,
        proformaResults,
        tenderResults,
        voyageResults,
        companyResults,
        forumResults,
        invoiceResults,
        fdaResults,
      ] = await Promise.all([
        // Vessels — search name, IMO, callSign
        db
          .select({ id: vessels.id, name: vessels.name, flag: vessels.flag, imoNumber: vessels.imoNumber })
          .from(vessels)
          .where(or(
            ilike(vessels.name, searchTerm),
            ilike(vessels.imoNumber, searchTerm),
            ilike(vessels.callSign, searchTerm),
          ))
          .limit(limit),

        // Ports — search name, code, country
        db
          .select({ id: ports.id, name: ports.name, country: ports.country, code: ports.code })
          .from(ports)
          .where(or(
            ilike(ports.name, searchTerm),
            ilike(ports.code, searchTerm),
            ilike(ports.country, searchTerm),
          ))
          .limit(limit),

        // Proformas — search reference number; role-filtered
        db
          .select({ id: proformas.id, referenceNumber: proformas.referenceNumber, totalUsd: proformas.totalUsd, approvalStatus: proformas.approvalStatus })
          .from(proformas)
          .where(
            isAdmin
              ? ilike(proformas.referenceNumber, searchTerm)
              : and(eq(proformas.userId, userId), ilike(proformas.referenceNumber, searchTerm))
          )
          .limit(limit),

        // Tenders — search vesselName, description
        db
          .select({ id: portTenders.id, vesselName: portTenders.vesselName, status: portTenders.status })
          .from(portTenders)
          .where(or(
            ilike(portTenders.vesselName, searchTerm),
            ilike(portTenders.description, searchTerm),
          ))
          .limit(limit),

        // Voyages — search vesselName, imoNumber; role-filtered
        db
          .select({ id: voyages.id, vesselName: voyages.vesselName, status: voyages.status })
          .from(voyages)
          .where(
            isAdmin
              ? or(ilike(voyages.vesselName, searchTerm), ilike(voyages.imoNumber, searchTerm))
              : and(
                  or(eq(voyages.userId, userId), eq(voyages.agentUserId, userId)),
                  or(ilike(voyages.vesselName, searchTerm), ilike(voyages.imoNumber, searchTerm)),
                )
          )
          .limit(limit),

        // Companies — search companyName; approved only
        db
          .select({ id: companyProfiles.id, companyName: companyProfiles.companyName, companyType: companyProfiles.companyType })
          .from(companyProfiles)
          .where(and(
            eq(companyProfiles.isApproved, true),
            ilike(companyProfiles.companyName, searchTerm),
          ))
          .limit(limit),

        // Forum topics — search title
        db
          .select({ id: forumTopics.id, title: forumTopics.title })
          .from(forumTopics)
          .where(ilike(forumTopics.title, searchTerm))
          .limit(limit),

        // Invoices — search title; user-filtered
        db
          .select({ id: invoices.id, title: invoices.title, amount: invoices.amount, status: invoices.status })
          .from(invoices)
          .where(
            isAdmin
              ? ilike(invoices.title, searchTerm)
              : and(eq(invoices.userId, userId), ilike(invoices.title, searchTerm))
          )
          .limit(limit),

        // FDA accounts — search reference number; user-filtered
        db
          .select({ id: fdaAccounts.id, referenceNumber: fdaAccounts.referenceNumber, status: fdaAccounts.status, totalActualUsd: fdaAccounts.totalActualUsd })
          .from(fdaAccounts)
          .where(
            isAdmin
              ? ilike(fdaAccounts.referenceNumber, searchTerm)
              : and(eq(fdaAccounts.userId, userId), ilike(fdaAccounts.referenceNumber, searchTerm))
          )
          .limit(limit),
      ]);

      return [
        ...vesselResults.map(v => ({
          type: "vessel",
          id: v.id,
          title: v.name || `Vessel #${v.id}`,
          subtitle: `${v.flag ? v.flag + " — " : ""}IMO: ${v.imoNumber || "N/A"}`,
          icon: "🚢",
          href: "/vessels",
        })),
        ...portResults.map(p => ({
          type: "port",
          id: p.id,
          title: p.name,
          subtitle: `${p.country || ""}${p.code ? " — " + p.code : ""}`,
          icon: "⚓",
          href: "/port-info",
        })),
        ...proformaResults.map(p => ({
          type: "proforma",
          id: p.id,
          title: p.referenceNumber || `PDA #${p.id}`,
          subtitle: `$${(p.totalUsd || 0).toLocaleString()} — ${p.approvalStatus || "draft"}`,
          icon: "📋",
          href: `/proformas/${p.id}`,
        })),
        ...tenderResults.map(t => ({
          type: "tender",
          id: t.id,
          title: t.vesselName || `Tender #${t.id}`,
          subtitle: t.status || "open",
          icon: "📢",
          href: `/tenders/${t.id}`,
        })),
        ...voyageResults.map(v => ({
          type: "voyage",
          id: v.id,
          title: v.vesselName || `Voyage #${v.id}`,
          subtitle: `Voyage — ${v.status || "planned"}`,
          icon: "🗺️",
          href: `/voyages/${v.id}`,
        })),
        ...companyResults.map(c => ({
          type: "company",
          id: c.id,
          title: c.companyName,
          subtitle: c.companyType || "company",
          icon: "🏢",
          href: `/directory/${c.id}`,
        })),
        ...forumResults.map(f => ({
          type: "forum",
          id: f.id,
          title: f.title,
          subtitle: "Forum Topic",
          icon: "💬",
          href: `/forum/${f.id}`,
        })),
        ...invoiceResults.map((inv: any) => ({
          type: "invoice",
          id: inv.id,
          title: inv.title || `Invoice #${inv.id}`,
          subtitle: `$${(inv.amount || 0).toLocaleString()} — ${inv.status || "draft"}`,
          icon: "💳",
          href: `/invoices`,
        })),
        ...fdaResults.map((f: any) => ({
          type: "fda",
          id: f.id,
          title: f.referenceNumber || `FDA #${f.id}`,
          subtitle: `FDA — ${f.status || "draft"}${f.totalActualUsd ? " — $" + Number(f.totalActualUsd).toLocaleString() : ""}`,
          icon: "📊",
          href: `/fda/${f.id}`,
        })),
      ];
    });

    res.json({ results, query: rawQuery });
  } catch (error) {
    next(error);
  }
});

export default router;
