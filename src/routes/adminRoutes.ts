import express, { Request, Response } from "express";
import { runNewsImageAgent } from "../services/imageGeneration";
import { checkApiKey } from "../middleware/checkApiKey";

const router = express.Router();

router.use(checkApiKey);

router.post("/generate-image", async (req: Request, res: Response) => {
  try {
    const result = await runNewsImageAgent();
    res.json(result);
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

export function setupAdminRoutes() {
  return router;
}
