# Multi-stage build for Node.js + Python
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built Node.js app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy server directory (includes datamind)
COPY server ./server

# Install Python dependencies
RUN pip install -r server/requirements.txt

EXPOSE 8080

CMD ["npm", "run", "start"]
