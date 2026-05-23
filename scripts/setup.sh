#!/bin/bash
# ============================================
# Pulse — First-Time Setup Helper
# ============================================

set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              ⚡ PULSE — Setup Helper             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check Node.js version
echo "🔍 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js $NODE_VERSION is too old. Please upgrade to Node.js 20+"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check ffmpeg
echo "🔍 Checking ffmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"
else
    echo "⚠️  ffmpeg not found system-wide (will use bundled ffmpeg-static)"
fi

# Create .env from template if not exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env created — edit it with your API keys"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Install dev dependencies
echo ""
echo "📦 Installing dev dependencies..."
npm install -D typescript tsx @types/node @types/better-sqlite3 @types/fluent-ffmpeg

# Create data directories
mkdir -p data/tmp

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              ✅ Setup Complete!                   ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Next steps:                                     ║"
echo "║  1. Edit .env with your API keys                 ║"
echo "║  2. Set ENABLED_PLATFORMS in .env                ║"
echo "║  3. Run: npm run dev                             ║"
echo "║                                                  ║"
echo "║  Platform-specific:                              ║"
echo "║  • Discord: npm run deploy:discord               ║"
echo "║  • Telegram: Disable privacy mode in @BotFather  ║"
echo "║  • WhatsApp: Scan QR code on first run           ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
