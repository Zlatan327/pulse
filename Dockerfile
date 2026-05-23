# ============================================
# Stage 1: Build TypeScript
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev deps for build)
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci || npm install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npx tsc

# ============================================
# Stage 2: Production Image
# ============================================
FROM node:20-slim AS production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create data directories
RUN mkdir -p /app/data/tmp

# Set environment
ENV NODE_ENV=production

# Run as non-root user
RUN groupadd -r pulse && useradd -r -g pulse pulse
RUN chown -R pulse:pulse /app
USER pulse

CMD ["node", "dist/main.js"]
