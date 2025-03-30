# News Maker

An AI-powered application that analyzes daily news, generates images based on the analysis, and provides access through a Telegram bot and admin API.

## Features

- Daily news analysis using AI
- AI-powered image generation based on news analysis
- Telegram bot for easy access to daily images
- Admin API for managing image generation and vector database
- Vector database for storing and retrieving news analysis
- Scheduled daily updates at 13:00
- Redis caching for improved performance
- Docker support for easy deployment

## Prerequisites

- Node.js (v18 or higher) for local development
- Docker and Docker Compose for containerized deployment
- OpenAI API key
- News API key
- Telegram Bot Token
- Pinecone API key and environment
- Admin API key (you can generate your own)

## Setup

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd news-maker
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
OPENAI_API_KEY=your_openai_api_key
NEWS_API_KEY=your_news_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_API_KEY=your_admin_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=news-analysis
PORT=3000
IMAGE_STORAGE_PATH=./images
```

4. Create a Pinecone index with the name specified in your `.env` file.

5. Run the application:
```bash
npm run dev
```

### Docker Deployment

1. Make sure you have Docker and Docker Compose installed.

2. Create a `.env` file as described above.

3. Build and start the containers:
```bash
docker-compose up -d
```

4. Check the logs:
```bash
docker-compose logs -f
```

5. Stop the containers:
```bash
docker-compose down
```

## Telegram Bot Commands

- `/start` - Welcome message
- `/getimage` - Get today's generated image

## Admin API Endpoints

All admin endpoints require an API key to be included in the `x-api-key` header.

### Generate Image for Specific Date
```
POST /admin/generate-image
Content-Type: application/json
x-api-key: your_admin_api_key

{
    "date": "2024-03-30"
}
```

### Fill Vector DB for Specific Date
```
POST /admin/fill-vector-db
Content-Type: application/json
x-api-key: your_admin_api_key

{
    "date": "2024-03-30"
}
```

## Health Check

The application includes a health check endpoint that monitors the Redis connection:

```
GET /health
```

## Directory Structure

```
news-maker/
├── src/
│   ├── services/
│   │   ├── imageGeneration.js
│   │   ├── telegramBot.js
│   │   ├── vectorDB.js
│   │   └── redis.js
│   ├── routes/
│   │   └── adminRoutes.js
│   └── app.ts
├── images/
├── .env
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## Docker Infrastructure

The application uses Docker Compose to manage the following services:

- `app`: The main Node.js application
- `redis`: Redis instance for caching

### Volumes

- `./images`: Persistent storage for generated images
- `redis_data`: Persistent storage for Redis data

### Health Checks

Both services include health checks to ensure they're running properly:
- App: Checks Redis connection and HTTP endpoint
- Redis: Checks Redis server status

## License

ISC 