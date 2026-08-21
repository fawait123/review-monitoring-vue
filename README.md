# Review Monitor

Aplikasi web modern untuk monitoring, pengumpulan (collecting), dan automated code review GitHub Pull Requests (PR) menggunakan bantuan AI agent (**Pi Coding Agent SDK**).

---

## Tech Stack

- **Framework**: [Nuxt 4](https://nuxt.com/) (Vue 3 + Nitro Engine)
- **Styling & UI**: Tailwind CSS v4, shadcn-vue / [Reka UI](https://reka-ui.com/), [Lucide Vue](https://lucide.dev/), `@nuxtjs/color-mode`
- **Charts & Visualisasi**: Apache ECharts (`echarts` & `vue-echarts`)
- **Database & ORM**: PostgreSQL 16 + [Drizzle ORM](https://orm.drizzle.team/)
- **AI Coding Agent**: `@earendil-works/pi-coding-agent`
- **GitHub Integration**: GitHub CLI (`gh`) via Device OAuth Flow

---

## Fitur Utama

1. **Dashboard Analytics**:
   - Visualisasi KPI PR (Total, Repo, Rasio Open/Merged/Closed, Avg Time-to-Review).
   - Breakdown PR per repository, per author, dan tren mingguan (12 bulan terakhir).
2. **Monitoring & List Pull Requests**:
   - Filter cepat berdasarkan repository dan status PR (Open, Merged, Closed).
   - Pagination SQL teroptimasi dan sinkronisasi real-time via tombol *Refresh*.
3. **AI Automated Code Review (Pi Agent)**:
   - Streaming review real-time (Server-Sent Events) dengan live terminal log.
   - Analisis file-by-file bertahap dengan *line clamping* (mencegah salah baris diff di GitHub).
   - Workspace interaktif untuk mengedit, menambah, dan menghapus komentar sebelum submit ke GitHub PR resmi.
4. **Manajemen Model AI**:
   - Konfigurasi runtime untuk memilih provider (Ollama, 9router, OpenAI API endpoints) dan model aktif.
   - Pengaturan *thinking level* (`off` hingga `max`).
5. **Koneksi GitHub**:
   - Status indikator koneksi `gh` di header dengan dukungan login cepat (Device Code Flow).

---

## Menjalankan Secara Lokal

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20+ atau v22+
- [pnpm](https://pnpm.io/) v9+ / v11+
- [GitHub CLI (`gh`)](https://cli.github.com/) terpasang dan terautentikasi (`gh auth login`)
- PostgreSQL instance yang berjalan

### 2. Konfigurasi Environment (`.env`)
Salin file `.env.example` ke `.env`:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5434/review_monitor
OLLAMA_API_KEY=your_ollama_key_here
NINE_ROUTER_API_KEY=your_key_here
```

### 3. Migrasi Database
```bash
# Push skema Drizzle ke PostgreSQL
pnpm drizzle-kit push
```

### 4. Jalankan Dev Server
```bash
pnpm dev
```
Buka browser di `http://localhost:3000`.

---

## Menjalankan dengan Docker Compose

Untuk menjalankan aplikasi beserta container PostgreSQL:

```bash
docker compose up --build -d
```

Aplikasi akan berjalan di port `http://localhost:3303` dan PostgreSQL di port `5434`.

---

## Testing & Type Checking

```bash
# Menjalankan test diff-parser
pnpm test

# Menjalankan typecheck TypeScript
pnpm typecheck

# Build bundle production
pnpm build
```
