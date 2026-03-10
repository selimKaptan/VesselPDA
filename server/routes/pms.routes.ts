import { Router } from "express";
import { db } from "../db";
import { equipmentCategories, equipmentItems, pmsJobs, workOrders, runningHoursLog, classSurveys, conditionReports, pmsTemplates } from "@shared/schema";
import { eq, and, desc, asc, lte, gte, isNull, sql, or } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

// ══════════════════════════════════════════════════════════════════
// EQUIPMENT CATEGORIES (Ekipman Kategorileri — ağaç yapısı)
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/equipment-tree", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const categories = await db.select().from(equipmentCategories)
      .where(eq(equipmentCategories.vesselId, vesselId))
      .orderBy(asc(equipmentCategories.sortOrder));
    const items = await db.select().from(equipmentItems)
      .where(eq(equipmentItems.vesselId, vesselId))
      .orderBy(asc(equipmentItems.sortOrder));
    
    // Ağaç yapısına dönüştür
    function buildTree(parentId: number | null): any[] {
      const cats = categories.filter(c => c.parentId === parentId);
      return cats.map(cat => ({
        ...cat,
        type: "category",
        children: buildTree(cat.id),
        equipment: items.filter(i => i.categoryId === cat.id).map(item => ({
          ...item,
          type: "equipment",
        })),
      }));
    }
    
    res.json({
      tree: buildTree(null),
      flatCategories: categories,
      flatEquipment: items,
      stats: {
        totalCategories: categories.length,
        totalEquipment: items.length,
        withRunningHours: items.filter(i => i.hasRunningHours).length,
        classRelevant: items.filter(i => i.classRelevant).length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/equipment-categories", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.insert(equipmentCategories).values({
      ...req.body,
      vesselId: parseInt(req.params.vesselId),
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/equipment", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.insert(equipmentItems).values({
      ...req.body,
      vesselId: parseInt(req.params.vesselId),
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/equipment/:id", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.update(equipmentItems).set({ ...req.body, updatedAt: new Date() })
      .where(eq(equipmentItems.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/equipment/:id", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(equipmentItems).where(eq(equipmentItems.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// PMS JOBS (Bakım Görevleri)
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/jobs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const overdue = req.query.overdue === "true";
    
    let query = db.select({
      job: pmsJobs,
      equipmentName: equipmentItems.name,
      equipmentCode: equipmentItems.code,
      categoryName: equipmentCategories.name,
    })
      .from(pmsJobs)
      .leftJoin(equipmentItems, eq(pmsJobs.equipmentId, equipmentItems.id))
      .leftJoin(equipmentCategories, eq(equipmentItems.categoryId, equipmentCategories.id))
      .where(eq(pmsJobs.vesselId, vesselId))
      .orderBy(asc(pmsJobs.nextDueDate))
      .$dynamic();
    
    const rows = await query;
    
    let filtered = rows;
    if (status) filtered = filtered.filter(r => r.job.status === status);
    if (priority) filtered = filtered.filter(r => r.job.priority === priority);
    if (overdue) filtered = filtered.filter(r => r.job.isOverdue);
    
    // Overdue kontrolü güncelle
    const now = new Date();
    for (const row of filtered) {
      const job = row.job;
      let isOd = false;
      let odDays = 0;
      if (job.nextDueDate && new Date(job.nextDueDate) < now) {
        isOd = true;
        odDays = Math.floor((now.getTime() - new Date(job.nextDueDate).getTime()) / 86400000);
      }
      if (job.nextDueRunningHours && job.equipmentId) {
        const equip = await db.select({ rh: equipmentItems.currentRunningHours }).from(equipmentItems).where(eq(equipmentItems.id, job.equipmentId)).limit(1);
        if (equip[0] && equip[0].rh && job.nextDueRunningHours <= equip[0].rh) {
          isOd = true;
        }
      }
      if (isOd !== job.isOverdue || odDays !== job.overdueDays) {
        await db.update(pmsJobs).set({ isOverdue: isOd, overdueDays: odDays }).where(eq(pmsJobs.id, job.id));
        job.isOverdue = isOd;
        job.overdueDays = odDays;
      }
    }
    
    res.json({
      jobs: filtered.map(r => ({ ...r.job, equipmentName: r.equipmentName, equipmentCode: r.equipmentCode, categoryName: r.categoryName })),
      summary: {
        total: filtered.length,
        overdue: filtered.filter(r => r.job.isOverdue).length,
        dueSoon: filtered.filter(r => !r.job.isOverdue && r.job.nextDueDate && new Date(r.job.nextDueDate) <= new Date(now.getTime() + 30 * 86400000)).length,
        active: filtered.filter(r => r.job.status === "active").length,
        completed: filtered.filter(r => r.job.status === "completed").length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/jobs", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const data = req.body;
    
    // Sonraki due date hesapla
    let nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;
    if (!nextDueDate && data.calendarIntervalDays) {
      nextDueDate = new Date(Date.now() + data.calendarIntervalDays * 86400000);
    }
    if (!nextDueDate && data.calendarIntervalMonths) {
      nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + data.calendarIntervalMonths);
    }
    
    const [job] = await db.insert(pmsJobs).values({
      ...data,
      vesselId,
      nextDueDate,
      createdBy: req.user?.id,
    }).returning();
    res.status(201).json(job);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/jobs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.update(pmsJobs).set({ ...req.body, updatedAt: new Date() })
      .where(eq(pmsJobs.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/jobs/:id", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(pmsJobs).where(eq(pmsJobs.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// WORK ORDERS (İş Emirleri)
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/work-orders", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const rows = await db.select({
      wo: workOrders,
      equipmentName: equipmentItems.name,
      jobTitle: pmsJobs.title,
    })
      .from(workOrders)
      .leftJoin(equipmentItems, eq(workOrders.equipmentId, equipmentItems.id))
      .leftJoin(pmsJobs, eq(workOrders.pmsJobId, pmsJobs.id))
      .where(eq(workOrders.vesselId, vesselId))
      .orderBy(desc(workOrders.createdAt));
    
    res.json({
      workOrders: rows.map(r => ({ ...r.wo, equipmentName: r.equipmentName, jobTitle: r.jobTitle })),
      summary: {
        total: rows.length,
        open: rows.filter(r => r.wo.status === "open").length,
        inProgress: rows.filter(r => r.wo.status === "in_progress").length,
        completed: rows.filter(r => r.wo.status === "completed").length,
        awaitingApproval: rows.filter(r => r.wo.status === "awaiting_approval").length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/work-orders", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const data = req.body;
    
    // İş emri numarası üret
    const count = await db.select({ count: sql<number>`count(*)` }).from(workOrders).where(eq(workOrders.vesselId, vesselId));
    const woNumber = `WO-${vesselId}-${String(Number(count[0].count) + 1).padStart(4, '0')}`;
    
    const [row] = await db.insert(workOrders).values({
      ...data,
      vesselId,
      workOrderNumber: woNumber,
      requestedBy: req.user?.id,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/work-orders/:id", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.update(workOrders).set({ ...req.body, updatedAt: new Date() })
      .where(eq(workOrders.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/work-orders/:id/approve", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const isMaster = req.user?.activeRole === "master" || req.user?.activeRole === "admin";
    const isSuper = req.user?.activeRole === "shipowner" || req.user?.activeRole === "admin";
    
    const update: any = { updatedAt: new Date() };
    if (isMaster) {
      update.masterApproval = true;
      update.masterApprovalDate = new Date();
    }
    if (isSuper) {
      update.superintendentApproval = true;
      update.superintendentApprovalDate = new Date();
    }
    
    const [wo] = await db.update(workOrders).set(update).where(eq(workOrders.id, id)).returning();
    
    // Eğer iş emri tamamlanmışsa ve pmsJobId varsa, pmsJobs tablosunu güncelle
    if (wo.status === "completed" && wo.pmsJobId) {
      const [job] = await db.select().from(pmsJobs).where(eq(pmsJobs.id, wo.pmsJobId)).limit(1);
      if (job) {
        let nextDue = null;
        if (job.calendarIntervalDays) nextDue = new Date(Date.now() + job.calendarIntervalDays * 86400000);
        else if (job.calendarIntervalMonths) {
          nextDue = new Date();
          nextDue.setMonth(nextDue.getMonth() + job.calendarIntervalMonths);
        }
        
        await db.update(pmsJobs).set({
          lastDoneDate: new Date(),
          lastDoneRunningHours: wo.runningHoursAtComplete,
          lastDoneBy: req.user?.email,
          lastDoneWorkOrderId: wo.id,
          nextDueDate: nextDue,
          nextDueRunningHours: job.runningHoursInterval ? (wo.runningHoursAtComplete || 0) + job.runningHoursInterval : null,
          isOverdue: false,
          overdueDays: 0,
        }).where(eq(pmsJobs.id, job.id));
      }
    }
    
    res.json(wo);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// RUNNING HOURS
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/running-hours", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const logs = await db.select({
      log: runningHoursLog,
      equipmentName: equipmentItems.name,
    })
      .from(runningHoursLog)
      .leftJoin(equipmentItems, eq(runningHoursLog.equipmentId, equipmentItems.id))
      .where(eq(runningHoursLog.vesselId, vesselId))
      .orderBy(desc(runningHoursLog.recordDate))
      .limit(100);
    
    res.json(logs.map(l => ({ ...l.log, equipmentName: l.equipmentName })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/equipment/:id/running-hours", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { runningHours, recordDate, notes } = req.body;
    
    const [equip] = await db.select().from(equipmentItems).where(eq(equipmentItems.id, id)).limit(1);
    if (!equip) return res.status(404).json({ error: "Equipment not found" });
    
    const increment = runningHours - (equip.currentRunningHours || 0);
    
    // Log ekle
    const [log] = await db.insert(runningHoursLog).values({
      vesselId: equip.vesselId,
      equipmentId: id,
      runningHours,
      previousRunningHours: equip.currentRunningHours,
      hoursIncrement: increment,
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      recordedBy: req.user?.id,
      notes,
    }).returning();
    
    // Ekipman güncelle
    await db.update(equipmentItems).set({
      currentRunningHours: runningHours,
      lastRunningHoursUpdate: new Date(),
      updatedAt: new Date(),
    }).where(eq(equipmentItems.id, id));
    
    res.json(log);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// CLASS & SURVEYS
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/surveys", isAuthenticated, async (req: any, res) => {
  try {
    const rows = await db.select().from(classSurveys)
      .where(eq(classSurveys.vesselId, parseInt(req.params.vesselId)))
      .orderBy(asc(classSurveys.dueDate));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/surveys", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.insert(classSurveys).values({
      ...req.body,
      vesselId: parseInt(req.params.vesselId),
      createdBy: req.user?.id,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/surveys/:id", isAuthenticated, async (req: any, res) => {
  try {
    const [row] = await db.update(classSurveys).set({ ...req.body, updatedAt: new Date() })
      .where(eq(classSurveys.id, parseInt(req.params.id))).returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// CONDITION REPORTS
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/condition-reports", isAuthenticated, async (req: any, res) => {
  try {
    const rows = await db.select({
      report: conditionReports,
      equipmentName: equipmentItems.name,
    })
      .from(conditionReports)
      .leftJoin(equipmentItems, eq(conditionReports.equipmentId, equipmentItems.id))
      .where(eq(conditionReports.vesselId, parseInt(req.params.vesselId)))
      .orderBy(desc(conditionReports.reportedDate));
    res.json(rows.map(r => ({ ...r.report, equipmentName: r.equipmentName })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/vessels/:vesselId/condition-reports", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const data = req.body;
    
    const [report] = await db.insert(conditionReports).values({
      ...data,
      vesselId,
      reportedBy: req.user?.id,
    }).returning();
    
    // Eğer aksiyon gerekiyorsa otomatik iş emri oluştur
    if (data.actionRequired) {
      const woNumber = `WO-COND-${vesselId}-${report.id}`;
      const [wo] = await db.insert(workOrders).values({
        vesselId,
        equipmentId: data.equipmentId,
        title: `Repair: ${data.title}`,
        description: `Condition report action: ${data.description}`,
        workType: "unplanned",
        priority: data.condition === "critical" ? "high" : "medium",
        status: "open",
        workOrderNumber: woNumber,
        requestedBy: req.user?.id,
      }).returning();
      
      await db.update(conditionReports).set({ workOrderId: wo.id }).where(eq(conditionReports.id, report.id));
    }
    
    res.status(201).json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// DASHBOARD & TEMPLATES
// ══════════════════════════════════════════════════════════════════

router.get("/vessels/:vesselId/pms-dashboard", isAuthenticated, async (req: any, res) => {
  try {
    const vesselId = parseInt(req.params.vesselId);
    const now = new Date();
    
    const [jobs, wos, surveys] = await Promise.all([
      db.select().from(pmsJobs).where(eq(pmsJobs.vesselId, vesselId)),
      db.select().from(workOrders).where(eq(workOrders.vesselId, vesselId)),
      db.select().from(classSurveys).where(eq(classSurveys.vesselId, vesselId)),
    ]);
    
    res.json({
      summary: {
        overdueJobs: jobs.filter(j => j.isOverdue).length,
        dueSoonJobs: jobs.filter(j => !j.isOverdue && j.nextDueDate && new Date(j.nextDueDate) <= new Date(now.getTime() + 30 * 86400000)).length,
        openWorkOrders: wos.filter(w => w.status === "open" || w.status === "in_progress").length,
        upcomingSurveys: surveys.filter(s => s.status === "upcoming").length,
        criticalDefects: jobs.filter(j => j.priority === "critical" && j.isOverdue).length,
      },
      recentWorkOrders: wos.slice(0, 5),
      overdueList: jobs.filter(j => j.isOverdue).slice(0, 10),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/pms-templates", isAuthenticated, async (req: any, res) => {
  try {
    const rows = await db.select().from(pmsTemplates);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
