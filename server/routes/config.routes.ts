import { Router } from "express";

const router = Router();

router.get("/mapbox", (_req, res) => {
  res.json({ token: process.env.VITE_MAPBOX_TOKEN || "" });
});

export default router;
