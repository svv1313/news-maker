import { ChatAnthropic } from "@langchain/anthropic";
import {
  StateGraph,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
import { Article } from '../types/news';

dotenv.config();

interface AgentState {
  newsArticles: Array<{
    title: string;
    description: string;
    url: string;
    source: string;
    publishedAt: string;
  }>;
  newsSummary: string | null;
  keyThemes: string[];
  imagePrompt: string | null;
  imageUrl: string | null;
  error: string | null;
}

const initialState: AgentState = {
  newsArticles: [],
  newsSummary: null,
  keyThemes: [],
  imagePrompt: null,
  imageUrl: null,
  error: null,
};

const llm = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-haiku-20240307",
});

// Node 1: Fetch News Articles
export const fetchNews = async (state: AgentState): Promise<AgentState> => {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
        throw new Error("ERROR: API key for NEWS_API_KEY is missing");
    }

    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=uspageSize=10page=1&apiKey=${newsApiKey}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        ...state,
        error: `Failed to fetch news: ${
          errorData.message || response.statusText
        }`,
      };
    }

    const data = await response.json();
    const articles = data.articles as Article[];

    const processedArticles = articles.map((article) => ({
      title: article.title || "",
      description: article.description || "",
      url: article.url || "",
      source: article.source?.name || "",
      publishedAt: article.publishedAt || "",
    }));

    return {
      ...state,
      newsArticles: processedArticles,
    };
  } catch (error) {
    return {
      ...state,
      error: `Error fetching news: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// Node 2: Analyze News with RAG
export const analyzeNews = async (state: AgentState): Promise<AgentState> => {
  if (state.error) return state;

  try {
    // Create context from news articles
    const context = state.newsArticles
      .map(
        (article) =>
          `Title: ${article.title}\nDescription: ${article.description}\nSource: ${article.source}`
      )
      .join("\n\n");

    // Create prompt for analysis
    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(
        "You are a news analyst specialized in identifying important trends and themes."
      ),
      new HumanMessage(`
        Analyze these recent news articles and provide:
        
        1. A concise summary (2-3 sentences) of the most significant current news trend
        2. A list of exactly 5 key themes or topics from these articles
        
        Format your response as follows:
        SUMMARY: [your summary here]
        THEMES: [theme1], [theme2], [theme3], [theme4], [theme5]
        
        Here are the articles:
        
        ${context}
      `),
    ]);

    // Get response from LLM
    const response = await llm.invoke([
      await prompt.formatMessages({ context }),
    ]);

    const responseText = response.content;

    // Parse the response
    const summaryMatch = /SUMMARY:(.+?)(?=\n|$)/s.exec(responseText as string);
    const themesMatch = /THEMES:(.+?)(?=\n|$)/s.exec(responseText as string);

    if (!summaryMatch || !themesMatch) {
      throw new Error("Could not parse LLM output correctly");
    }

    const summary = summaryMatch[1].trim();
    const themes = themesMatch[1].split(",").map((theme) => theme.trim());

    return {
      ...state,
      newsSummary: summary,
      keyThemes: themes,
    };
  } catch (error) {
    return {
      ...state,
      error: `Error analyzing news: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// Node 3: Create Image Generation Prompt
export const createImagePrompt = async (state: AgentState): Promise<AgentState> => {
  if (state.error) return state;

  try {
    const prompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(`
        You are a specialist in creating effective prompts for AI image generation.
        Your task is to craft a detailed, visually descriptive prompt based on news content.
      `),
      new HumanMessage(`
        Create a detailed prompt for an AI image generator based on this news summary and themes.
        Focus on visual elements, style, composition, and mood.
        The prompt should be under 100 words and highly descriptive.
        
        News Summary: ${state.newsSummary}
        Key Themes: ${state.keyThemes.join(", ")}
        
        Format your response as a single paragraph without any prefixes or explanations.
      `),
    ]);

    const response = await llm.invoke([
      await prompt.formatMessages({
        summary: state.newsSummary,
        themes: state.keyThemes.join(", "),
      }),
    ]);

    return {
      ...state,
      imagePrompt: response.content as string,
    };
  } catch (error) {
    return {
      ...state,
      error: `Error creating image prompt: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// Node 4: Generate Image
export const generateImage =  async (state: AgentState): Promise<AgentState> => {
  if (state.error || !state.imagePrompt) return state;

  try {
    const stabilityApiKey = process.env.STABILITY_API_KEY;

    const response = await fetch(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${stabilityApiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [{ text: state.imagePrompt }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        ...state,
        error: `Failed to generate image: ${
          errorData.message || response.statusText
        }`,
      };
    }

    const data = await response.json();
    const imageBase64 = data.artifacts[0].base64;

    // In a real app, you might save this to a file or database
    // For this example, we'll just imagine we have a URL
    const mockImageUrl = `https://example.com/generated-image-${Date.now()}.png`;

    return {
      ...state,
      imageUrl: mockImageUrl,
    };
  } catch (error) {
    return {
      ...state,
      error: `Error generating image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export const createNewsImageGraph = async () => {
  const builder = new StateGraph(MessagesAnnotation)
    .addNode("fetchNews", fetchNews)
    .addEdge(START, "fetchNews")
    .addNode("analyzeNews", analyzeNews)
    .addEdge("analyzeNews", "fetchNews")
    .addNode("createImagePrompt", createImagePrompt)
    .addEdge("createImagePrompt", "analyzeNews")
    .addNode("generateImage", generateImage)
    .addEdge("generateImage", END);

  // Handle error conditions
  builder.addConditionalEdges("fetchNews", (state: AgentState) =>
    state.error ? "end" : "analyzeNews"
  );

  builder.addConditionalEdges("analyzeNews", (state: AgentState) =>
    state.error ? "end" : "createImagePrompt"
  );

  builder.addConditionalEdges("createImagePrompt", (state: AgentState) =>
    state.error ? "end" : "generateImage"
  );

  return builder.compile();
}

// Main function to run the agent
export const runNewsImageAgent = async () => {
  try {
    const graph = await createNewsImageGraph();
    const result = await graph.invoke(initialState);

    return {
      summary: result.newsSummary,
      themes: result.keyThemes,
      imagePrompt: result.imagePrompt,
      imageUrl: result.imageUrl,
    };
  } catch (error) {
    console.error("Failed to run agent:", error);
    return null;
  }
}
