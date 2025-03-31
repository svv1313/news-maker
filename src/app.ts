import express, { Request, Response } from "express";
import schedule from "node-schedule";
import { setupTelegramBot } from "./services/telegramBot";
import { setupAdminRoutes } from "./routes/adminRoutes";
import { runNewsImageAgent } from "./services/imageGeneration";
import { getCachedData } from "./services/redis";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

const fs = require("fs");
const imagePath = process.env.IMAGE_STORAGE_PATH || "./images";
if (!fs.existsSync(imagePath)) {
  fs.mkdirSync(imagePath, { recursive: true });
}

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check Redis connection
    await getCachedData("health_check");
    res.status(200).json({ status: "healthy" });
  } catch (error) {
    res
      .status(500)
      .json({ status: "unhealthy", error: (error as Error).message });
  }
});

// Routes
app.use("/admin", setupAdminRoutes());

// Schedule daily image generation at 13:00
schedule.scheduleJob("0 13 * * *", async () => {
  try {
    await runNewsImageAgent();
  } catch (error) {
    console.error("Error in scheduled job:", error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

setupTelegramBot();
