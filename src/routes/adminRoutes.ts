import express, { Request, Response } from "express";
import { generateDailyImage } from "../services/imageGeneration";
import { fillVectorDB } from "../services/vectorDB";
import { checkApiKey } from "../middleware/checkApiKey";

const router = express.Router();

router.use(checkApiKey);

// Generate image for a specific date
router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const result = await generateDailyImage(date);
    res.json(result);
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// Fill vector DB for a specific date
router.post("/fill-vector-db", async (req: Request, res: Response) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const result = await fillVectorDB(date);
    res.json(result);
  } catch (error) {
    console.error("Error filling vector DB:", error);
    res.status(500).json({ error: "Failed to fill vector DB" });
  }
});

export function setupAdminRoutes() {
  return router;
}
