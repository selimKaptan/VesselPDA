import { Router } from "express";
import { storage } from "../storage";
import { insertFdaMappingTemplateSchema } from "@shared/schema";

const router = Router();

router.get("/api/fda-mapping-templates", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user) return res.sendStatus(401);
  const templates = await storage.getFdaMappingTemplates(req.user.id);
  res.json(templates);
});

router.post("/api/fda-mapping-templates", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user) return res.sendStatus(401);
  
  const result = insertFdaMappingTemplateSchema.safeParse({
    ...req.body,
    userId: req.user.id
  });
  
  if (!result.success) {
    return res.status(400).json(result.error);
  }
  
  const template = await storage.createFdaMappingTemplate(result.data);
  res.status(201).json(template);
});

router.patch("/api/fda-mapping-templates/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user) return res.sendStatus(401);
  
  const id = parseInt(req.params.id);
  const template = await storage.updateFdaMappingTemplate(id, req.user.id, req.body);
  
  if (!template) return res.sendStatus(404);
  res.json(template);
});

router.delete("/api/fda-mapping-templates/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user) return res.sendStatus(401);
  
  const id = parseInt(req.params.id);
  const success = await storage.deleteFdaMappingTemplate(id, req.user.id);
  
  if (!success) return res.sendStatus(404);
  res.sendStatus(204);
});

router.post("/api/fda-mapping-templates/:id/set-default", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  if (!req.user) return res.sendStatus(401);
  
  const id = parseInt(req.params.id);
  const success = await storage.setFdaMappingTemplateDefault(id, req.user.id);
  
  if (!success) return res.sendStatus(404);
  res.sendStatus(204);
});

export default router;
