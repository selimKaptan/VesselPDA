import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { voyages, fdaAccounts, invoices, portExpenses, proformas, vessels, ports, companyProfiles } from "@shared/schema";
import { generateVoyageFinancialReportPdf } from "../voyage-financial-report-pdf";

const router = Router();

async function getVoyageFinancialReport(voyageId: number, userId: string) {
  // 1. Fetch Voyage data
  const [voyage] = await db
    .select({
      id: voyages.id,
      vesselName: voyages.vesselName,
      vesselId: voyages.vesselId,
      portId: voyages.portId,
      eta: voyages.eta,
      etd: voyages.etd,
      status: voyages.status,
      userId: voyages.userId,
    })
    .from(voyages)
    .where(eq(voyages.id, voyageId));

  if (!voyage) throw new Error("Voyage not found");

  // Fetch port info
  const [port] = await db.select().from(ports).where(eq(ports.id, voyage.portId));

  // 2. Fetch PDA (Proforma) data
  const voyageProformas = await storage.getProformasByVoyage(voyageId);
  const totalPda = voyageProformas.reduce((sum, p) => sum + (p.totalUsd || 0), 0);
  const pdaLineItems = voyageProformas.flatMap(p => p.lineItems || []);

  // 3. Fetch FDA data
  const fdas = await db.select().from(fdaAccounts).where(eq(fdaAccounts.voyageId, voyageId));
  const totalFda = fdas.reduce((sum, f) => sum + (Number(f.totalActualUsd) || 0), 0);
  
  // 4. Fetch Port Expenses
  const expenses = await storage.getPortExpensesByVoyage(voyageId);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amountUsd || 0), 0);
  const expensesByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amountUsd || 0);
    return acc;
  }, {});

  // 5. Fetch Invoices
  const voyageInvoices = await db.select().from(invoices).where(eq(invoices.voyageId, voyageId));
  const totalBilled = voyageInvoices.reduce((sum, i) => sum + (i.amount || 0), 0); 
  
  let totalPaid = 0;
  for (const inv of voyageInvoices) {
    const balance = await storage.getInvoiceBalance(inv.id);
    totalPaid += balance.paid;
  }
  const outstanding = totalBilled - totalPaid;

  const commission = { rate: 0, amount: 0 };

  const variance = totalFda - totalPda;
  const variancePercent = totalPda !== 0 ? (variance / totalPda) * 100 : 0;
  
  const totalRevenue = totalBilled;
  const totalCost = totalExpenses; 
  const netBalance = totalRevenue - totalCost;

  const duration = voyage.eta && voyage.etd 
    ? Math.ceil((new Date(voyage.etd).getTime() - new Date(voyage.eta).getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

  return {
    voyage: {
      vesselName: voyage.vesselName,
      portName: port?.name || "Unknown",
      eta: voyage.eta,
      etd: voyage.etd,
      duration: `${duration} days`,
      userId: voyage.userId,
    },
    pda: {
      total: totalPda,
      lineItems: pdaLineItems,
    },
    fda: {
      total: totalFda,
      lineItems: [], 
      variance,
      variancePercent,
    },
    portExpenses: {
      total: totalExpenses,
      byCategory: expensesByCategory,
    },
    invoices: {
      totalBilled,
      totalPaid,
      outstanding,
    },
    commission,
    summary: {
      totalRevenue,
      totalCost,
      netBalance,
      fdaAccuracy: 100 - Math.abs(variancePercent),
      voyageProfitability: totalRevenue !== 0 ? (netBalance / totalRevenue) * 100 : 0,
    }
  };
}

router.get("/:id/financial-report", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const report = await getVoyageFinancialReport(parseInt(req.params.id), req.user?.id);
    res.json(report);
  } catch (error: any) {
    console.error("[voyage-report:GET] failed:", error);
    res.status(error.message === "Voyage not found" ? 404 : 500).json({ message: error.message });
  }
});

router.get("/:id/financial-report/pdf", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const voyageId = parseInt(req.params.id);
    const userId = req.user?.claims?.sub || req.user?.id;
    const report = await getVoyageFinancialReport(voyageId, userId);
    
    // Get company profile for logo/header
    const companyProfile = await storage.getCompanyProfileByUser(report.voyage.userId || "");
    
    const pdfBuffer = await generateVoyageFinancialReportPdf(report, companyProfile);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Voyage_Financial_Report_${voyageId}.pdf`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[voyage-report:PDF] failed:", error);
    res.status(error.message === "Voyage not found" ? 404 : 500).json({ message: error.message });
  }
});

export default router;
