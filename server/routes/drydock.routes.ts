import { Router } from "express";
import { db } from "../db";
import { drydockProjects, drydockJobs, insertDrydockProjectSchema, insertDrydockJobSchema } from "../../shared/schema";
import { eq, and, desc, lt, gte } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const projects = await db.select().from(drydockProjects)
      .where(eq(drydockProjects.userId, userId))
      .orderBy(desc(drydockProjects.plannedStart));
    res.json(projects);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/vessels/:vesselId", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const projects = await db.select().from(drydockProjects)
      .where(and(
        eq(drydockProjects.vesselId, parseInt(req.params.vesselId)), 
        eq(drydockProjects.userId, userId)
      ))
      .orderBy(desc(drydockProjects.plannedStart));
    res.json(projects);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/upcoming", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const now = new Date();
    const sixMonthsLater = new Date(now.getTime() + 183 * 24 * 60 * 60 * 1000);
    
    const projects = await db.select().from(drydockProjects)
      .where(and(
        eq(drydockProjects.userId, userId), 
        eq(drydockProjects.status, "planned"),
        gte(drydockProjects.plannedStart, now),
        lt(drydockProjects.plannedStart, sixMonthsLater)
      ))
      .orderBy(drydockProjects.plannedStart);
    res.json(projects);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const validated = insertDrydockProjectSchema.parse(req.body);
    const [project] = await db.insert(drydockProjects).values({ ...validated, userId }).returning();
    res.json(project);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const [updated] = await db.update(drydockProjects)
      .set(req.body)
      .where(and(
        eq(drydockProjects.id, parseInt(req.params.id)), 
        eq(drydockProjects.userId, userId)
      ))
      .returning();
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    await db.delete(drydockProjects)
      .where(and(
        eq(drydockProjects.id, parseInt(req.params.id)), 
        eq(drydockProjects.userId, userId)
      ));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.get("/:id/jobs", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const jobs = await db.select().from(drydockJobs)
      .where(and(
        eq(drydockJobs.projectId, parseInt(req.params.id)), 
        eq(drydockJobs.userId, userId)
      ))
      .orderBy(drydockJobs.jobNumber);
    res.json(jobs);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/:id/jobs", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const project = await db.select().from(drydockProjects)
      .where(eq(drydockProjects.id, parseInt(req.params.id)))
      .limit(1);
      
    if (!project.length) return res.status(404).json({ message: "Project not found" });
    
    const validated = insertDrydockJobSchema.parse(req.body);
    const [job] = await db.insert(drydockJobs).values({ 
      ...validated, 
      projectId: parseInt(req.params.id), 
      vesselId: project[0].vesselId, 
      userId 
    }).returning();
    
    // Update project actual cost
    const projectJobs = await db.select().from(drydockJobs).where(eq(drydockJobs.projectId, parseInt(req.params.id)));
    const totalActual = projectJobs.reduce((acc, j) => acc + (j.actualCost || 0), 0);
    await db.update(drydockProjects).set({ actualCost: totalActual }).where(eq(drydockProjects.id, parseInt(req.params.id)));
    
    res.json(job);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.patch("/jobs/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const updateData: any = { ...req.body };
    if (req.body.status === "completed") updateData.completionDate = new Date();
    
    const [updated] = await db.update(drydockJobs)
      .set(updateData)
      .where(and(
        eq(drydockJobs.id, parseInt(req.params.id)), 
        eq(drydockJobs.userId, userId)
      ))
      .returning();
      
    // Update project actual cost
    const projectJobs = await db.select().from(drydockJobs).where(eq(drydockJobs.projectId, updated.projectId));
    const totalActual = projectJobs.reduce((acc, j) => acc + (j.actualCost || 0), 0);
    await db.update(drydockProjects).set({ actualCost: totalActual }).where(eq(drydockProjects.id, updated.projectId));
    
    res.json(updated);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/jobs/:id", async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const [job] = await db.select().from(drydockJobs).where(eq(drydockJobs.id, parseInt(req.params.id)));
    if (!job) return res.status(404).json({ message: "Job not found" });
    
    await db.delete(drydockJobs).where(eq(drydockJobs.id, parseInt(req.params.id)));
    
    // Update project actual cost
    const projectJobs = await db.select().from(drydockJobs).where(eq(drydockJobs.projectId, job.projectId));
    const totalActual = projectJobs.reduce((acc, j) => acc + (j.actualCost || 0), 0);
    await db.update(drydockProjects).set({ actualCost: totalActual }).where(eq(drydockProjects.id, job.projectId));
    
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
