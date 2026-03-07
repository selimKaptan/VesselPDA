import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { voyages, proformas, fdaAccounts, invoices, portExpenses, statementOfFacts, noticeOfReadiness, portCalls, husbandryOrders, vessels, ports } from "@shared/schema";
import { companyProfiles } from "@shared/models/auth";

const router = Router();

router.get("/:voyageId", isAuthenticated, async (req: any, res) => {
  try {
    const voyageId = parseInt(req.params.voyageId);
    if (isNaN(voyageId)) {
      return res.status(400).json({ message: "Invalid voyageId" });
    }

    // Fetch voyage with vessel and port details
    const [voyage] = await db
      .select({
        voyage: voyages,
        vessel: vessels,
        port: ports,
      })
      .from(voyages)
      .leftJoin(vessels, eq(voyages.vesselId, vessels.id))
      .leftJoin(ports, eq(voyages.portId, ports.id))
      .where(eq(voyages.id, voyageId));

    if (!voyage) {
      return res.status(404).json({ message: "Voyage not found" });
    }

    // Fetch Agent Company Profile
    const [agentProfile] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, voyage.voyage.agentUserId || ""));

    // Fetch Port Call details
    const [portCall] = await db
      .select()
      .from(portCalls)
      .where(eq(portCalls.voyageId, voyageId))
      .limit(1);

    // Fetch PDA/FDA
    const proformaList = await db
      .select()
      .from(proformas)
      .where(eq(proformas.voyageId, voyageId));

    const fdaList = await db
      .select()
      .from(fdaAccounts)
      .where(eq(fdaAccounts.voyageId, voyageId));

    // Fetch SOF & NOR
    const sofRecords = await db
      .select()
      .from(statementOfFacts)
      .where(eq(statementOfFacts.voyageId, voyageId));

    const norRecords = await db
      .select()
      .from(noticeOfReadiness)
      .where(eq(noticeOfReadiness.voyageId, voyageId));

    // Fetch Invoices & Expenses
    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.voyageId, voyageId));

    const expenseList = await db
      .select()
      .from(portExpenses)
      .where(eq(portExpenses.voyageId, voyageId));

    // Fetch Husbandry Services
    const husbandryList = await db
      .select()
      .from(husbandryOrders)
      .where(eq(husbandryOrders.voyageId, voyageId));

    res.json({
      voyage: voyage.voyage,
      vessel: voyage.vessel,
      port: voyage.port,
      agent: agentProfile || null,
      portCall: portCall || null,
      proformas: proformaList,
      fdas: fdaList,
      sof: sofRecords,
      nor: norRecords,
      invoices: invoiceList,
      expenses: expenseList,
      husbandry: husbandryList,
    });
  } catch (error) {
    console.error("Error fetching agent report data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
