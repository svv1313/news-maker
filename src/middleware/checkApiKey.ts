import { Response, Request, NextFunction } from "express";

export const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
};
