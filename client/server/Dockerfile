FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript (if needed)
RUN npm run build || true

# Expose port
EXPOSE 3001

# Run the server
CMD ["npx", "ts-node", "index.ts"]
