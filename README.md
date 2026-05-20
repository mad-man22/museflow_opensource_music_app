# 🎵 MuseFlow

> An ultra-premium, AI-powered, self-hosted music streaming platform proxy client built on top of YouTube Music. Styled with glassmorphic aesthetics and driven by advanced audio extraction and deep learning recommendations.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015-black.svg?logo=next.js)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?logo=docker)](https://www.docker.com)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-blue.svg)](https://aistudio.google.com)

---

## ✨ Features

* **🎧 Custom YouTube Music Client:** Infinite access to all tracks, albums, search, artists, trending data, and community playlists.
* **🛡️ Zero Piracy/Copyright Storage:** MuseFlow does *not* cache or store audio files. It dynamically deciphers YouTube signatures and pulls adaptive bitrate audio streams in real-time.
* **✨ Dynamic Glassmorphism UI:** Inspired by Apple Music and Spotify, featuring custom adaptive backdrop-blur layouts that inherit ambient color palettes from the active track's thumbnail.
* **⚡ Persistent Gapless Playback:** Playback continues seamlessly across Page Router transitions, queue shifts, and offline events.
* **📊 Visual Equalizer:** Canvas-driven, high-fidelity real-time audio visualizer displaying frequency spectrum grids.
* **🎤 Scrolling Synced Lyrics:** Parsed from `.lrc` schemas, offering karaoke-style lyrics synced to the exact millisecond of the audio timeline.
* **🧠 Gemini AI Playlists:** Natural language playlist builders. Type *"Energetic cyberpunk gym tunes"* or *"Cozy rainy day lofi"* to trigger mood classifiers and build instant streaming loops.
* **📡 WebSocket Multi-Device Control:** Synchronize playback status, volume, and playback queues across active devices in real-time.

---

## 🏗️ System Architecture

```text
    ┌───────────────────────────────────────────────┐
    │          Next.js 15 (Streaming Client)        │
    └───────────────────────┬───────────────────────┘
                            │ (HTTP/WebSockets)
                            ▼
    ┌───────────────────────────────────────────────┐
    │            FastAPI (API Gateway)              │
    └─────┬───────────────────┬───────────────────┬─┘
          │                   │                   │
          ▼ (Read/Write)      ▼ (Read/Write)      ▼ (Fetch Stream)
    ┌───────────┐       ┌───────────┐       ┌───────────────────────────────┐
    │ PostgreSQL│       │Redis Cache│       │ Node.js Stream Service        │
    │ (Relational)      │(Streams/  │       │ (youtubei.js Extractor)       │
    └───────────┘       │Metadata)  │       └───────────────┬───────────────┘
                        └───────────┘                       │ (Decipher Ciphers)
                                                            ▼
                                                    [YouTube Music APIs]
```

---

## 🚀 Quick Start (Docker Compose)

The easiest way to get MuseFlow running is via Docker Compose:

1. **Clone & Configure:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com)).

2. **Launch Services:**
   ```bash
   docker-compose up --build -d
   ```

3. **Access Services:**
   - **Frontend Client:** [http://localhost:3000](http://localhost:3000)
   - **FastAPI API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Stream Extraction Portal:** [http://localhost:3001](http://localhost:3001)

---

## 🛠️ Local Development Setup

To run MuseFlow locally without Docker:

### 1. Requirements
* Node.js v18+
* Python 3.11+
* PostgreSQL & Redis instances running locally

### 2. Run Stream Service (Node.js)
```bash
cd stream-service
npm install
npm run dev
```

### 3. Run Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Run Frontend (Next.js 15)
```bash
cd frontend
npm install
npm run dev
```

---

## 📂 Project Directory Structure

```text
museflow/
├── backend/            # FastAPI framework handling auth, logic, caches, and AI
├── stream-service/     # Express/youtubei.js stream extractor microservice
├── frontend/           # Premium Next.js 15 App router streaming dashboard
├── docker-compose.yml  # Multi-container conductor
└── README.md           # This document
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.
