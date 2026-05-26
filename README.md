<div align="center">

# ⚡ Pulse

### AI-First Chat Companion — Audio Summaries for Discord, Telegram & X

An invisible assistant that listens, filters out the noise, and drops a **30-second audio summary** on command.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)

</div>

---

## 🎯 The Problem

Group chats move too fast. You return to **dozens of unread messages**, chaotic voice notes, and buried PDF files. Catching up feels like a chore.

## ✨ The Solution

Type `/catchup` in any group chat. Pulse drops a **30-second audio clip** summarizing the timeline, auto-generates a task board, and translates foreign voice notes — all in under 10 seconds.

---

## 🚀 Features

### 1. `/catchup` — Instant Audio Summaries
- Summarizes 50–500 messages into a concise, spoken audio clip
- Powered by **Gemini 1.5 Flash** for intelligent summarization
- Natural voice via **ElevenLabs** text-to-speech
- Works across Discord, Telegram, and X
- **Multiple Catchup Modes**: Tailor the tone of your summary:
  - `standard`: Professional and concise
  - `fun`: Highly energetic and humorous
  - `roast`: Sarcastic and playfully mocking
  - `story`: Epic bedtime story narration
  - `urgent`: Rapid-fire, highly professional urgency
  - `manager`: High-level executive view of progress and blockers
  - `empathic`: Supportive tone highlighting team wins
  - `for-me`: Highly personalized summary focusing strictly on tasks and mentions involving you
- **Advanced Querying**:
  - **Timeframes**: Ask for `/catchup 1hr` or use the Discord `timeframe` slash command option.
  - **User Targeting**: Ask for `/catchup @username` to focus the summary heavily on one person.
  - **Text-Only Mode**: Skip the audio and get a fast text breakdown (Telegram: `/catchup text`, Discord: `/catchup format:Text Only`).
  - **Private Delivery**: Get the summary sent directly to your DMs instead of the public channel (Telegram: `/catchup private`, Discord: `/catchup delivery:Private (DM)`).
  - **Contextual Thread Summaries**: Reply to any message with `/catchup` (or `@PulseBot summarize` in Discord) to summarize the conversation exactly from that point onward!

### 2. 📅 Automated Daily Minutes (`/daily`)
- Schedule a daily digest to be delivered to your group chat automatically.
- Pulse drops a short audio summary alongside a detailed **Markdown meeting minutes** file containing action items, key discussions, and overall chat vibe.
- **Opt-in commands**:
  - Discord: `/daily enable:True time:18:00`
  - Telegram: `/daily on 18:00`

### 3. 🗣️ Voice Conversation Agent
- Pulse acts as a fully conversational AI participant.
- **Direct Voice Replies:** Reply to Pulse's audio summary with your own voice note to ask follow-up questions!
- Pulse remembers the chat context and responds with a natural, generated voice message.

### 4. 📋 Auto-Generated Task Boards
- Extracts action items from conversations and documents
- Assigns tasks to people mentioned in the chat
- Tracks deadlines and priorities
- Displays as a formatted checklist alongside the audio summary

### 5. 🌍 Real-Time Audio Translation
- Detects non-English voice notes automatically
- Transcribes natively via **Gemini 1.5 Flash**
- Translates to your configured language
- Replies with both text and audio translation

---

## 📦 Quick Start

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org))
- **ffmpeg** ([download](https://ffmpeg.org)) — *included in Docker setup*
- API keys for:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini 1.5 Flash)
  - [ElevenLabs](https://elevenlabs.io) (Text-to-Speech)
- **Discord**: Channel commands (`/catchup`)
- **Telegram**: Group commands (`/catchup fun 1hr`)
- **X (Twitter)**: Mention threads (`@PulseBot summary`)

## 🚀 Setup & Installation

### 1. The Core Engine (Bot)
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/yourusername/pulse.git
   cd pulse
   npm install
   ```
2. Copy the `.env.example` to `.env` and add your AI keys (OpenAI & ElevenLabs).
3. Add your Bot tokens for Discord, Telegram, and X.

### 2. The Web Dashboard (Identity Hub)
Pulse includes a sleek Next.js dashboard where users can link their X and Telegram accounts to route summaries cross-platform.
1. Navigate to the web folder:
   ```bash
   cd web
   npm install
   ```
2. Set up your OAuth credentials in `.env` (Google and Twitter).
3. Start the dashboard:
   ```bash
   npm run dev
   ```
   *Visit `http://localhost:3000` to log in and link your accounts!*

## 🎮 Running Pulse

Start the core engine for your configured platforms:
```bash
npm start
```GEMINI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# Choose which platforms to run
ENABLED_PLATFORMS=discord,telegram,x

# Discord
DISCORD_TOKEN=your_token
DISCORD_CLIENT_ID=your_client_id

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# X (Twitter) (requires a dedicated user account)
X_USERNAME=pulsebot
X_PASSWORD=password123
X_EMAIL=pulsebot@example.com
```

4. Start the engine:
```bash
npm start
```

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/pulse.git
cd pulse

# Configure environment
cp .env.example .env
# Edit .env with your API keys and platform tokens

# Start
docker-compose up -d

# View logs
docker-compose logs -f
```

### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/pulse.git
cd pulse

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and platform tokens

# Start in development mode
npm run dev

# Or build and run in production
npm run build
npm start
```

---

## 🔧 Platform Setup

### Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it "Pulse"
3. Go to **Bot** → Click **Reset Token** → Copy the token
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Message Content Intent
5. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Read Message History`, `Attach Files`, `Use Slash Commands`
6. Copy the generated URL and invite the bot to your server
7. Add to `.env`:
   ```
   DISCORD_TOKEN=your-bot-token
   DISCORD_CLIENT_ID=your-application-id
   ENABLED_PLATFORMS=discord
   ```
8. Register slash commands:
   ```bash
   npm run deploy:discord
   ```

### Telegram

1. Open Telegram, search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. **Critical:** Disable Privacy Mode:
   - Send `/mybots` → Select your bot → **Bot Settings** → **Group Privacy** → **Turn off**
5. Add the bot to your group chat
   - ⚠️ If you changed privacy mode after adding, **remove and re-add** the bot
6. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-bot-token
   ENABLED_PLATFORMS=telegram
   ```

> **Note:** Telegram bots cannot read historical messages. The bot must be in the group to accumulate messages before `/catchup` produces meaningful results.



## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Gemini API key for summarization and transcription |
| `ELEVENLABS_API_KEY` | ✅ | — | ElevenLabs API key for TTS |
| `ELEVENLABS_VOICE_ID` | ✅ | — | ElevenLabs voice ID to use |
| `ELEVENLABS_MODEL_ID` | ❌ | `eleven_flash_v2_5` | `eleven_flash_v2_5` (fast) or `eleven_multilingual_v2` (quality) |
| `DISCORD_TOKEN` | 🔶 | — | Discord bot token (required for Discord) |
| `DISCORD_CLIENT_ID` | 🔶 | — | Discord application ID (required for Discord) |
| `TELEGRAM_BOT_TOKEN` | 🔶 | — | Telegram bot token (required for Telegram) |
| `ENABLED_PLATFORMS` | ❌ | `discord` | Comma-separated: `discord,telegram,x` |
| `SUMMARY_MAX_MESSAGES` | ❌ | `100` | Max messages to include in a catchup |
| `SUMMARY_TARGET_DURATION` | ❌ | `30` | Target audio summary length in seconds |
| `DEFAULT_LANGUAGE` | ❌ | `en` | Default language for translations (ISO 639-1) |
| `LOG_LEVEL` | ❌ | `info` | Logging level: `debug`, `info`, `warn`, `error` |

🔶 = Required only if that platform is enabled

---

## 🏗️ Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Discord   │  │  Telegram   │  │      X      │
│  Adapter    │  │  Adapter    │  │  Adapter    │
│ (discord.js)│  │  (grammY)   │  │(twitter-api)│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │    Shared Core    │
              │                   │
              │  ┌─────────────┐  │
              │  │ Message DB  │  │  SQLite
              │  │  (SQLite)   │  │
              │  └──────┬──────┘  │
              │         │         │
              │  ┌──────▼──────┐  │
              │  │ Summarizer  │  │  Gemini
              │  │  + Tasks    │  │  1.5 Flash
              │  └──────┬──────┘  │
              │         │         │
              │  ┌──────▼──────┐  │
              │  │   Voice     │  │  ElevenLabs
              │  │  Engine     │  │
              │  └──────┬──────┘  │
              │         │         │
              │  ┌──────▼──────┐  │
              │  │   Audio     │  │  ffmpeg
              │  │ Converter   │  │
              │  └─────────────┘  │
              └───────────────────┘
```

### How `/catchup` Works

```
User types /catchup
       │
       ▼
Fetch messages from DB (since last catchup)
       │
       ▼
Build chronological transcript
       │
       ▼
Gemini: Generate spoken summary (~75 words for 30s)
Gemini: Extract action items as JSON
       │
       ▼
ElevenLabs: Convert summary text to speech (MP3)
       │
       ▼
ffmpeg: Convert to platform format (OGG/Opus for TG)
       │
       ▼
Send audio + task checklist to chat
```

---

## 🛠️ NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm start` | Start all enabled platforms (production) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start:discord` | Start only the Discord adapter |
| `npm run start:telegram` | Start only the Telegram adapter |
| `npm run deploy:discord` | Register Discord slash commands |

---

## 🐳 Docker Deployment

### Build and run

```bash
docker-compose up -d --build
```

### View logs

```bash
docker-compose logs -f pulse
```

### Update

```bash
git pull
docker-compose up -d --build
```

### Persistent data

- **Database**: `./data/pulse.db` — all logged messages and catchup history

---

## 📊 Cost Estimates

| Service | Free Tier | Approximate Cost |
|---------|-----------|-----------------|
| **Gemini 1.5 Flash** | 15 RPM / 1M tokens/min | **Free** (within limits) or ~$0.0001 per summary |
| **ElevenLabs** | 10K chars/mo (~20 catchups) | $5/mo for 30K chars (~60 catchups) |
| **VPS** | — | $5-10/mo (1GB RAM minimum) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  
**Built with ❤️ using Gemini, ElevenLabs, and too much coffee.**

</div>
