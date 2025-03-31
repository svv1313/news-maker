import { Response, Request, NextFunction } from "express";

export const checkApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    res.status(401).send({ error: "Invalid API key" });
    return;
  }

  next();
};
