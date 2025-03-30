// imageGeneration.ts

import axios from "axios";
import { OpenAI } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Pinecone } from "@pinecone-database/pinecone";
import { promises as fs } from "fs";
import path from "path";
import { getCachedData, setCachedData } from "./redis";

// Define environment variables with proper typing
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY as string;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT as string;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME as string;
const NEWS_API_KEY = process.env.NEWS_API_KEY as string;
const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH as string;

if (
  !OPENAI_API_KEY ||
  !PINECONE_API_KEY ||
  !PINECONE_ENVIRONMENT ||
  !PINECONE_INDEX_NAME ||
  !NEWS_API_KEY ||
  !IMAGE_STORAGE_PATH
) {
  throw new Error("One or more environment variables are missing.");
}

const openai = new OpenAI({
  openAIApiKey: OPENAI_API_KEY,
});

const chatModel = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  modelName: "gpt-4-turbo-preview",
});

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
  environment: PINECONE_ENVIRONMENT,
});

// Type Definitions
interface NewsArticle {
  title: string;
  description: string;
}

interface CachedResult {
  date: string;
  analysis: string;
  imagePath: string;
}

export async function getNews(
  fromDate: string,
  toDate: string
): Promise<NewsArticle[]> {
  const cacheKey = `news_${fromDate}_${toDate}`;
  const cachedNews = await getCachedData(cacheKey);

  if (cachedNews) {
    return cachedNews;
  }

  const response = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      apiKey: NEWS_API_KEY,
      from: fromDate,
      to: toDate,
      language: "en",
      sortBy: "publishedAt",
    },
  });

  const articles: NewsArticle[] = response.data.articles;
  await setCachedData(cacheKey, articles);
  return articles;
}

export async function analyzeNews(articles: NewsArticle[]): Promise<string> {
  const newsSummary = articles
    .map(
      (article) =>
        `Title: ${article.title}\nDescription: ${article.description}\n`
    )
    .join("\n");

  const analysisPrompt = new SystemMessage(
    "You are a news analyst. Analyze the following news articles and provide a comprehensive summary of the main themes and significant events."
  );

  const analysis = await chatModel.invoke([
    analysisPrompt,
    new HumanMessage(newsSummary),
  ]);

  return analysis.content;
}

export async function generateImagePrompt(analysis: string): Promise<string> {
  const promptSystem = new SystemMessage(
    "You are an expert at creating detailed image generation prompts. Create a vivid, detailed prompt for an image that represents the main themes of the news analysis."
  );

  const prompt = await chatModel.invoke([
    promptSystem,
    new HumanMessage(
      `Based on this news analysis, create a detailed image generation prompt:\n${analysis}`
    ),
  ]);

  return prompt.content;
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });

  return response.data[0].url;
}

export async function downloadAndSaveImage(
  imageUrl: string,
  date: string
): Promise<string> {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const fileName = `image_${date}.png`;
  const filePath = path.join(IMAGE_STORAGE_PATH, fileName);

  await fs.writeFile(filePath, response.data);
  return filePath;
}

export async function saveToVectorDB(
  analysis: string,
  date: string
): Promise<void> {
  const index = pinecone.Index(PINECONE_INDEX_NAME);

  await index.upsert({
    vectors: [
      {
        id: `news_${date}`,
        values: await getEmbedding(analysis),
        metadata: {
          date,
          analysis,
        },
      },
    ],
  });
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function generateDailyImage(
  date: string = new Date().toISOString().split("T")[0]
): Promise<CachedResult> {
  const cacheKey = `daily_image_${date}`;
  const cachedResult = await getCachedData(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 1);
  fromDate.setHours(13, 0, 0, 0);

  const toDate = new Date();
  toDate.setHours(13, 0, 0, 0);

  const articles = await getNews(fromDate.toISOString(), toDate.toISOString());
  const analysis = await analyzeNews(articles);
  const imagePrompt = await generateImagePrompt(analysis);
  const imageUrl = await generateImage(imagePrompt);
  const savedPath = await downloadAndSaveImage(imageUrl, date);
  await saveToVectorDB(analysis, date);

  const result: CachedResult = {
    date,
    analysis,
    imagePath: savedPath,
  };

  await setCachedData(cacheKey, result);
  return result;
}
