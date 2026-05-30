# MajinBu — AI Food Inspiration

Sistem AI Food Inspiration berbasis prompt. User memasukkan preferensi makanan, AI memberikan kandidat makanan Indonesia lengkap dengan gambar, detail, resep cara membuat, dan video tutorial.

## Use Case

| Skenario | Contoh Prompt | Output |
|----------|--------------|--------|
| **Mencari ide masakan** | *"makanan pedas gurih yang enak dimakan saat hujan"* | Seblak, Mie Ayam Bakso Pedas, Ayam Geprek |
| **Inspirasi bekal** | *"makanan praktis untuk bekal kantor"* | Nasi Goreng, Tumis Kangkung, Ayam Teriyaki |
| **Masakan rumahan** | *"masakan berkuah segar untuk buka puasa"* | Soto Ayam, Sop Buntut, Sayur Asem |
| **Camilan** | *"jajanan tradisional manis legit"* | Klepon, Pisang Goreng, Kue Cubit |
| **Mencoba hal baru** | *"makanan khas Sulawesi yang unik"* | Coto Makassar, Konro, Pallubasa |

## Show Case

Project ini mendemonstrasikan:

1. **Multi-AI Integration** — Tidak terikat satu provider AI. Sistem menggunakan adapter OpenAI-compatible yang bisa dipasangkan dengan Gemini, OpenAI, DeepSeek, Anthropic, atau model self-hosted cukup dengan mengganti 3 environment variable.

2. **Async Video Pipeline** — Video generation berjalan asynchronous. Backend memulai job, frontend polling status tiap 4 detik, dan video ditampilkan begitu selesai — tanpa blocking user experience.

3. **Smart Caching** — Detail makanan dan video di-cache berdasarkan hash dari prompt + nama makanan. Request yang sama di masa depan akan langsung mengambil dari database tanpa perlu memanggil AI lagi.

4. **Resilient Architecture** — Retry otomatis dengan exponential backoff untuk HTTP errors, rate limiting per-IP, image proxy untuk CORS bypass, dan logging bertingkat untuk debugging.

5. **CLI Integration** — PixVerse diakses via command line interface (bukan HTTP API), menunjukkan fleksibilitas arsitektur dalam mengintegrasikan tools eksternal.

## Tech Stack

- **Frontend & Backend**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **AI**: OpenAI-compatible adapter (supports Gemini, OpenAI, Anthropic, DeepSeek, self-hosted, dll)
- **Image**: Pexels API (dengan proxy server untuk hindari CORS)
- **Video**: PixVerse CLI

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 15+
- **PixVerse CLI** — sudah terinstall dan login (`pixverse auth login`)
- **Pexels API Key** — daftar di https://www.pexels.com/api/

## Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd majinbu
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` dan isi:

```env
# AI Configuration (wajib)
AI_API_KEY=your_ai_api_key
AI_MODEL=deepseek-v4-flash-free

# Base URL (optional — hanya untuk custom/self-hosted provider)
# AI_BASE_URL=https://api.openai.com/v1
# AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# Pexels (wajib)
PEXELS_API_KEY=your_pexels_api_key

# Database (wajib)
DATABASE_URL=postgresql://user:password@localhost:5432/majinbu
VIDEO_STORAGE_PATH=./storage/videos

# Debug (optional)
# AI_LOG_RAW_RESPONSE=true
# AI_HTTP_RETRIES=3
```

### 3. Setup Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Buat Folder Storage

```bash
mkdir -p storage/videos
```

### 5. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── food-candidates/route.ts    # POST — kandidat makanan
│   │   ├── food-detail/route.ts        # POST — detail + resep
│   │   ├── video-status/route.ts       # GET/POST — polling & trigger video
│   │   ├── video/[id]/route.ts         # GET — stream video lokal
│   │   ├── image-proxy/route.ts        # GET — proxy Pexels (CORS bypass)
│   │   └── health/route.ts             # GET — health check
│   ├── page.tsx                        # Halaman utama
│   ├── layout.tsx                      # Layout root + font
│   └── globals.css                     # Global styles + animasi
├── components/
│   └── food/
│       ├── FoodCandidateCard.tsx        # Card kandidat + grid
│       ├── FoodResultCard.tsx           # Detail makanan + video
│       └── index.ts                     # Re-export
├── features/
│   └── food/
│       ├── food.service.ts              # Business logic utama
│       ├── food.schemas.ts              # Zod schemas (legacy)
│       └── food.types.ts               # TypeScript interfaces (FE + BE)
├── integrations/
│   ├── ai/
│   │   ├── ai.types.ts                  # Tipe data AI
│   │   ├── ai.service.ts               # Adapter HTTP + retry + logging
│   │   └── index.ts                    # Prompt templates + parser
│   ├── pexels/
│   │   ├── pexels.service.ts           # Search + scoring gambar
│   │   └── pexels.types.ts
│   ├── pixverse/
│   │   ├── pixverse.service.ts         # CLI wrapper create + poll
│   │   └── pixverse.types.ts
│   └── gemini/
│       ├── gemini.service.ts           # Legacy Gemini adapter
│       └── gemini.types.ts
├── lib/
│   ├── hash.ts                         # generatePromptHash
│   ├── logger.ts                       # Logger sederhana
│   ├── scoring.ts                      # Utility scoring
│   ├── storage.ts                      # Download video + file utils
│   └── rateLimit.ts                    # In-memory rate limiter
└── db/
    └── prisma.ts                       # Prisma client singleton
```

## Database Schema

### FoodRequest
Menyimpan satu sesi request user.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| prompt | String | Prompt asli user |
| promptHash | String | Hash untuk cache lintas request |
| createdAt | DateTime | Timestamp |

### FoodCandidate
Kandidat makanan hasil AI, terhubung ke satu request.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| candidateKey | String | ID dari AI ("food-1", "food-2", etc) |
| requestId | String | Foreign key ke FoodRequest |
| namaMakanan | String | Nama makanan |
| deskripsiSingkat | String | Deskripsi singkat |
| foodImageUrl | String? | URL gambar dari Pexels |
| foodImageSource | String? | Sumber gambar |
| foodImageMatchScore | Int? | Skor kecocokan gambar |

### FoodDetail
Detail makanan + resep untuk satu request (satu per request).

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| requestId | String (unique) | Foreign key ke FoodRequest |
| promptHash | String | Hash untuk cache |
| namaMakanan | String | Nama makanan |
| deskripsiDetail | String | Deskripsi detail |
| karakterRasa | JSONB | Array of strings |
| tekstur | String | Deskripsi tekstur |
| bahanUtama | JSONB | Array bahan utama |
| resepBahan | JSONB | Array bahan resep |
| langkahMemasak | JSONB | Array langkah |
| cocokUntuk | String | Kapan cocok dimakan |
| deskripsiVisual | String | Prompt untuk video |

### VideoAsset
Status dan lokasi video, terhubung ke satu detail.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| detailId | String (unique) | Foreign key ke FoodDetail |
| jobId | String? | ID job dari PixVerse |
| videoUrl | String? | Remote URL dari PixVerse |
| videoPath | String? | Path file lokal |
| status | VideoStatus | PENDING / PROCESSING / COMPLETED / FAILED |
| errorMessage | String? | Error message jika gagal |
| provider | String? | Nama provider |

## API Endpoints

### POST /api/food-candidates

Mendapatkan kandidat makanan dari AI + gambar dari Pexels.

```bash
curl -X POST http://localhost:3000/api/food-candidates \
  -H "Content-Type: application/json" \
  -d '{"prompt": "makanan pedas gurih untuk malam hari"}'
```

**Response:**
```json
{
  "requestId": "clx...",
  "candidates": [
    {
      "id": "clx...",
      "candidateKey": "food-1",
      "namaMakanan": "Seblak",
      "deskripsiSingkat": "Pedas gurih dengan kerupuk basah",
      "foodImageUrl": "/api/image-proxy?url=...",
      "foodImageSource": "pexels",
      "foodImageMatchScore": 85
    }
  ]
}
```

### POST /api/food-detail

Mendapatkan detail, resep, dan memulai video generation untuk kandidat terpilih.

```bash
curl -X POST http://localhost:3000/api/food-detail \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "clx...",
    "selectedCandidateId": "clx...",
    "prompt": "makanan pedas gurih untuk malam hari"
  }'
```

### GET /api/video-status?requestId=...

Polling status video generation.

```bash
curl http://localhost:3000/api/video-status?requestId=clx...
```

### POST /api/video-status

Trigger memulai video generation (dipanggil frontend otomatis).

```bash
curl -X POST http://localhost:3000/api/video-status \
  -H "Content-Type: application/json" \
  -d '{"requestId": "clx..."}'
```

### GET /api/video/:id

Stream video lokal atau redirect ke remote URL.

```bash
curl -I http://localhost:3000/api/video/<videoAssetId>
```

### GET /api/image-proxy?url=...

Proxy gambar Pexels (bypass CORS/referrer blocking). Dipanggil otomatis oleh frontend.

```bash
curl -I "http://localhost:3000/api/image-proxy?url=https://images.pexels.com/.../photo.jpg"
```

### GET /api/health

Cek status semua service.

```bash
curl http://localhost:3000/api/health
```

## Workflow

```
User Input Prompt
       │
       ▼
  POST /api/food-candidates
       │
       ├── AI (OpenAI-compatible) → 3 kandidat makanan
       ├── Pexels API → gambar untuk setiap kandidat
       └── Response → kandidat + gambar
       │
       ▼
  User Pilih Kandidat
       │
       ▼
  POST /api/food-detail
       │
       ├── Cek cache database (by requestId + promptHash)
       ├── Jika tidak ada → AI → detail + resep
       ├── Simpan ke database
       ├── Trigger video generation (async)
       └── Response → detail + resep + videoStatus
       │
       ▼
  Frontend Polling GET /api/video-status (tiap 4 detik)
       │
       ├── PixVerse CLI → create video → poll status
       ├── Download video ke local storage
       └── Update status ke COMPLETED / FAILED
       │
       ▼
  Tampilkan ke User
       ├── Detail makanan + resep
       ├── Video player (stream dari server lokal)
       └── Error handling jika gagal
```

## Konfigurasi AI

Sistem menggunakan adapter OpenAI-compatible. Cukup set 2 env var:

| Variable | Wajib | Deskripsi |
|----------|-------|-----------|
| `AI_API_KEY` | ✅ | API key dari provider AI |
| `AI_MODEL` | ✅ | Nama model (contoh: `gemini-2.0-flash`, `gpt-4o`, `deepseek-v4-flash-free`) |
| `AI_BASE_URL` | ❌ | Base URL API (hanya untuk custom/self-hosted). Default: `https://api.openai.com/v1` |

Contoh kombinasi:

```env
# OpenAI
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Gemini via OpenAI-compatible
AI_API_KEY=AIza...
AI_MODEL=gemini-2.0-flash
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai

# DeepSeek
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com/v1
```

### Debug AI

```env
AI_LOG_RAW_RESPONSE=true   # Log raw response AI di terminal
AI_HTTP_RETRIES=3          # Jumlah retry HTTP (default: 3, backoff eksponensial)
```

## Video Generation

Video menggunakan **PixVerse CLI** (bukan API langsung):

```bash
pixverse auth login        # Login sekali
pixverse create video ...   # Generate video
pixverse task status <id>   # Cek status
```

Pipeline video:
1. Backend panggil `pixverse create video --prompt "..." --no-wait --json`
2. Polling `pixverse task status <id> --json` tiap 5 detik
3. Setelah COMPLETED, download video ke `VIDEO_STORAGE_PATH`
4. Serve via endpoint `/api/video/:id`

## Development Commands

```bash
npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema ke database
npx prisma studio    # Prisma Studio (GUI database)
```

## Catatan MVP

- Kandidat makanan maksimal 3 item
- Gambar kandidat dari Pexels dengan fallback emoji
- Cache detail & video berdasarkan `promptHash` (bisa di-share antar request berbeda)
- Field array menggunakan JSONB di PostgreSQL
- Video generation async: start → polling → download
- Rate limiting in-memory per IP untuk endpoints
- Image proxy untuk bypass CORS Pexels
- Retry otomatis dengan exponential backoff untuk AI HTTP errors

## Next Steps

- Job queue (Redis/Bull) untuk video generation
- Autentikasi user (NextAuth)
- Fitur favorit dan riwayat
- Dashboard monitoring
- Migrasi gambar ke next/image untuk optimasi LCP
