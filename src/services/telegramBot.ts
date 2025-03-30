import TelegramBot from "node-telegram-bot-api";
import { promises as fs } from "fs";
import path from "path";

let bot: TelegramBot;

async function getLatestImage(): Promise<string | null> {
  const imagePath = process.env.IMAGE_STORAGE_PATH || "./images";

  try {
    const files = await fs.readdir(imagePath);
    const imageFiles = files.filter(
      (file) => file.startsWith("image_") && file.endsWith(".png")
    );

    if (imageFiles.length === 0) {
      return null;
    }

    const latestImage = imageFiles.sort().pop();

    if (!latestImage) {
      return null;
    }

    return path.join(imagePath, latestImage);
  } catch (error) {
    console.error("Error reading image files:", error);
    return null;
  }
}

export function setupTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      "Telegram bot token is not set in the environment variables."
    );
  }

  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "Welcome to the News Image Bot! Use /getimage to get today's image."
    );
  });

  bot.onText(/\/getimage/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    try {
      const latestImage = await getLatestImage();

      if (!latestImage) {
        bot.sendMessage(
          chatId,
          "No images available yet. Please try again later."
        );
        return;
      }

      await bot.sendPhoto(chatId, latestImage);
    } catch (error) {
      console.error("Error sending image:", error);
      bot.sendMessage(
        chatId,
        "Sorry, there was an error retrieving the image. Please try again later."
      );
    }
  });

  console.log("Telegram bot is running");
}
