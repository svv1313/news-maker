import axios from 'axios';
import { OpenAI } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Pinecone } from "@pinecone-database/pinecone";
import { promises as fs } from 'fs';
import path from 'path';
import { getCachedData, setCachedData } from './redis.js';

const openai = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-turbo-preview",
});

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
    environment: process.env.PINECONE_ENVIRONMENT as string,
});

export const getNews = async (fromDate: string, toDate: string) => {
    const cacheKey = `news_${fromDate}_${toDate}`;
    const cachedNews = await getCachedData(cacheKey);
    
    if (cachedNews) {
        return cachedNews;
    }

    const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
            apiKey: process.env.NEWS_API_KEY,
            from: fromDate,
            to: toDate,
            language: 'en',
            sortBy: 'publishedAt',
        },
    });

    const articles = response.data.articles;
    await setCachedData(cacheKey, articles);
    return articles;
}

export const analyzeNews = async (articles: { title: string, description: string }[]) => {
    const newsSummary = articles.map(article => 
        `Title: ${article.title}\nDescription: ${article.description}\n`
    ).join('\n');

    const analysisPrompt = new SystemMessage(
        'You are a news analyst. Analyze the following news articles and provide a comprehensive summary of the main themes and significant events.'
    );

    const analysis = await chatModel.invoke([
        analysisPrompt,
        new HumanMessage(newsSummary),
    ]);

    return analysis.content;
}

async function generateImagePrompt(analysis) {
    const promptSystem = new SystemMessage(
        'You are an expert at creating detailed image generation prompts. Create a vivid, detailed prompt for an image that represents the main themes of the news analysis.'
    );

    const prompt = await chatModel.invoke([
        promptSystem,
        new HumanMessage(`Based on this news analysis, create a detailed image generation prompt:\n${analysis}`),
    ]);

    return prompt.content;
}

async function generateImage(prompt) {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
    });

    return response.data[0].url;
}

async function downloadAndSaveImage(imageUrl, date) {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const fileName = `image_${date}.png`;
    const filePath = path.join(process.env.IMAGE_STORAGE_PATH, fileName);
    
    await fs.writeFile(filePath, response.data);
    return filePath;
}

async function saveToVectorDB(analysis, date) {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    
    await index.upsert({
        vectors: [{
            id: `news_${date}`,
            values: await getEmbedding(analysis),
            metadata: {
                date,
                analysis,
            }
        }]
    });
}

async function getEmbedding(text) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

export async function generateDailyImage(date = new Date().toISOString().split('T')[0]) {
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

    const result = {
        date,
        analysis,
        imagePath: savedPath,
    };

    await setCachedData(cacheKey, result);
    return result;
} 