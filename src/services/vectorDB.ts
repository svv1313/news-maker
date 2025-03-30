import { OpenAI } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { getNews, analyzeNews } from "./imageGeneration";

// ENV VARS
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY as string;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT as string;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME as string;

if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_ENVIRONMENT || !PINECONE_INDEX_NAME) {
  throw new Error("Missing required environment variables");
}

const openai = new OpenAI({
  openAIApiKey: OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
  environment: PINECONE_ENVIRONMENT,
});

// Define TypeScript types for response objects
interface EmbeddingResponse {
  embedding: number[];
}

interface AnalysisResponse {
  date: string;
  status: string;
  message: string;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  // Type assertion to ensure correct typing
  const embedding = (response.data as EmbeddingResponse[])[0].embedding;

  return embedding;
}

export async function fillVectorDB(date: string): Promise<AnalysisResponse> {
  const fromDate = new Date(date);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(date);
  toDate.setHours(23, 59, 59, 999);

  const articles = await getNews(fromDate.toISOString(), toDate.toISOString());
  const analysis = await analyzeNews(articles);

  const index = pinecone.Index(PINECONE_INDEX_NAME);

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

  return {
    date,
    status: 'success',
    message: 'Vector DB updated successfully',
  };
}

export async function querySimilarNews(query: string, limit = 5): Promise<any[]> {
  const index = pinecone.Index(PINECONE_INDEX_NAME);
  const queryEmbedding = await getEmbedding(query);

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK: limit,
    includeMetadata: true,
  });

  return queryResponse.matches.map((match: any) => ({
    date: match.metadata.date,
    analysis: match.metadata.analysis,
    score: match.score,
  }));
}