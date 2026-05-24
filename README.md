<div align="center">

# ⚡ Pulse

### AI-First Chat Companion — Audio Summaries for Discord, Telegram & WhatsApp

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
- Works across Discord, Telegram, and WhatsApp
- **Multiple Catchup Modes**: Tailor the tone of your summary:
  - `standard`: Professional and concise
  - `fun`: Highly energetic and humorous
  - `roast`: Sarcastic and playfully mocking
  - `story`: Epic bedtime story narration
  - `urgent`: Rapid-fire, highly professional urgency
  - `manager`: High-level executive view of progress and blockers
  - `empathic`: Supportive tone highlighting team wins
  - `for-me`: Highly personalized summary focusing strictly on tasks and mentions involving you

### 2. 🗣️ Voice Conversation Agent
- Pulse acts as a fully conversational AI participant.
- **Direct Voice Replies:** Reply to Pulse's audio summary with your own voice note to ask follow-up questions!
- Pulse remembers the chat context and responds with a natural, generated voice message.

### 3. 📋 Auto-Generated Task Boards
- Extracts action items from conversations and documents
- Assigns tasks to people mentioned in the chat
- Tracks deadlines and priorities
- Displays as a formatted checklist alongside the audio summary

### 4. 🌍 Real-Time Audio Translation
- Detects non-English voice notes automatically
- Transcribes natively via **Gemini 1.5 Flash**
- Translates to your configured language
- Replies with both text and audio translation

---

## 🎬 Hackathon Video Demo Flow

To demonstrate Pulse's full capabilities, try this flow:
1. **Group Chaos:** Have team members send various messages, documents, and foreign language voice notes in the chat.
2. **The Catchup:** Type `/catchup fun` to trigger an energetic audio summary + task checklist.
3. **The Follow-Up:** Reply directly to Pulse's audio message with a voice note saying *"Hey Pulse, who is handling the API integration?"*
4. **Agentic Response:** Pulse will fetch the chat context, answer your question conversationally, and reply with a new generated voice note!

---

## 📦 Quick Start

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org))
- **ffmpeg** ([download](https://ffmpeg.org)) — *included in Docker setup*
- API keys for:
  - [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini 1.5 Flash)
  - [ElevenLabs](https://elevenlabs.io) (Text-to-Speech)

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

### WhatsApp

1. Prepare a **dedicated phone number** for the bot
   - ⚠️ Using your personal number is **not recommended** — there is a risk of account restrictions
2. Add to `.env`:
   ```
   WHATSAPP_ENABLED=true
   ENABLED_PLATFORMS=whatsapp
   ```
3. Start the bot: `npm run start:whatsapp`
4. Scan the QR code displayed in the terminal with WhatsApp:
   - Open WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
5. Add the bot's number to your group chat

> **Warning:** WhatsApp automation uses an unofficial library (`whatsapp-web.js`). While widely used, it carries inherent risks. Use a dedicated number and avoid spammy patterns.

---

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
| `WHATSAPP_ENABLED` | 🔶 | `false` | Enable WhatsApp adapter |
| `ENABLED_PLATFORMS` | ❌ | `discord` | Comma-separated: `discord,telegram,whatsapp` |
| `SUMMARY_MAX_MESSAGES` | ❌ | `100` | Max messages to include in a catchup |
| `SUMMARY_TARGET_DURATION` | ❌ | `30` | Target audio summary length in seconds |
| `DEFAULT_LANGUAGE` | ❌ | `en` | Default language for translations (ISO 639-1) |
| `LOG_LEVEL` | ❌ | `info` | Logging level: `debug`, `info`, `warn`, `error` |

🔶 = Required only if that platform is enabled

---

## 🏗️ Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Discord   │  │  Telegram   │  │  WhatsApp   │
│  Adapter    │  │  Adapter    │  │  Adapter    │
│ (discord.js)│  │  (grammY)   │  │(wwebjs)     │
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
ffmpeg: Convert to platform format (OGG/Opus for TG & WA)
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
| `npm run start:whatsapp` | Start only the WhatsApp adapter |
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
- **WhatsApp session**: `./whatsapp-auth/` — avoids re-scanning QR code on restart

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
