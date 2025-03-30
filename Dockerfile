FROM node:18-alpine

WORKDIR /app


COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p images

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 