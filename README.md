# Kynettic — Edge AI P2P Trading Platform

**QVAC Hackathon I submission** — all inference runs on-device via `@qvac/sdk`. No cloud AI. No datacenter.

## What it does

Kynettic is a P2P crypto trading platform where users can create autonomous trading agents. The agents analyse live market data and produce buy/sell decisions **entirely on the user's own hardware** using a locally-loaded Llama 3.2 1B Instruct model via the QVAC SDK.

- **Edge AI inference** — model loads into the Next.js Node.js process; zero round-trips to an AI cloud
- **P2P marketplace** — users post buy/sell ads; other users execute trades
- **Agent system** — create a strategy, let the on-device model reason over live prices and recent trades, then submit the decision back to the API
- **KYC tiers** — progressive verification (BVN → NIN → selfie/address)
- **Internal transfers** — move balances between users instantly

## Architecture

```
frontend/   Next.js 14 (App Router)
  └─ src/app/api/inference/
       ├─ load/route.ts    — POST: loads LLAMA_3_2_1B_INST_Q4_0 via @qvac/sdk, streams SSE progress
       └─ complete/route.ts — POST: runs completion({history, stream:true}), returns full text

backend/    Go · Gin · GORM · PostgreSQL · Redis
  └─ internal/
       ├─ handler/         HTTP boundary (Gin)
       ├─ service/         Business logic (interfaces)
       ├─ repository/      GORM queries
       └─ models/          GORM structs
```

The Next.js API routes act as a **local inference server** — `@qvac/sdk` runs in the Node.js process (not in the browser), so the React app calls `/api/inference/*` over HTTP and the model never leaves the machine.

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | For Next.js + @qvac/sdk |
| Go | ≥ 1.21 | Backend |
| PostgreSQL | ≥ 14 | Primary database |
| Redis | ≥ 7 | Sessions, rate limiting, caching |
| RAM | ≥ 4 GB | Llama 3.2 1B Q4_0 ≈ 800 MB |
| Disk | ≥ 2 GB | Model weights cached after first load |

## Quick start

### 1. Clone & install

```bash
git clone <repo-url>
cd qvac-hackathon

# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
cp .env.example .env
# Edit .env — set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME,
#             JWT_SECRET, JWT_REFRESH_SECRET, KYC_ENCRYPTION_KEY,
#             KYC_BLIND_INDEX_KEY, PIN_PEPPER, RESEND_API_KEY
go mod download
```

### 2. Start services

```bash
# Terminal 1 — PostgreSQL & Redis (or use your own)
# Terminal 2 — Backend
cd backend && go run main.go

# Terminal 3 — Frontend
cd frontend && npm run dev
```

### 3. Load the model

Open `http://localhost:3000`. On first visit, click **Load Model** — the app downloads Llama 3.2 1B Instruct Q4_0 (~800 MB) once and keeps it resident. A progress bar shows download status via Server-Sent Events.

Once the status banner shows **Ready**, AI agents can run inference.

## QVAC SDK usage

```typescript
// Load the model once (Next.js API route — Node.js side)
import { loadModel, LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk";
import type { ModelProgressUpdate } from "@qvac/sdk";

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  onProgress: (p: ModelProgressUpdate) => console.log(p.percentage + "%"),
});

// Run inference
import { completion } from "@qvac/sdk";

const run = completion({
  modelId,
  history: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt   },
  ],
  stream: true,
});
const result = await run.final;
console.log(result.contentText);
```

The model singleton lives on `globalThis` and survives Next.js hot-reloads.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Yes | PostgreSQL connection |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | ≥ 32 chars, high entropy |
| `KYC_ENCRYPTION_KEY` | Yes | AES key for BVN/NIN encryption |
| `KYC_BLIND_INDEX_KEY` | Yes | HMAC key for duplicate detection |
| `PIN_PEPPER` | Yes | Server-side PIN hash secret |
| `RESEND_API_KEY` | Yes | Transactional email (OTP) |
| `REDIS_HOST` | Yes (if Redis enabled) | Default: localhost:6379 |
| `COINGECKO_API_KEY` | No | Increases CoinGecko rate limits |
| `CLOUDINARY_*` | No | KYC document uploads |
| `TELEGRAM_BOT_TOKEN` | No | Admin alert bot |

Frontend has no additional environment variables — inference runs through Next.js API routes.

## License

MIT — see [LICENSE](LICENSE).
# qvac
# qvac
