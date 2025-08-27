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

# Install Python and venv
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built Node.js app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy Python server
COPY server ./server
COPY requirements.txt ./
COPY server/requirements.txt ./server/requirements.txt

# Create virtual environment and install Python dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# Install both base and server-specific requirements (order matters for resolver)
RUN pip install -r requirements.txt && pip install -r server/requirements.txt

EXPOSE 8080

CMD ["npm", "run", "start"]
