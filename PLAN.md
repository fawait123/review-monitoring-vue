# Migrasi Next.js → Nuxt.js (Vue 3) + PostgreSQL + Docker

## Context

Aplikasi "Review Monitor" — monitoring & review PR GitHub pakai Pi agent.
Saat ini Next.js 16 App Router + React 19. Migrasi ke Nuxt.js dengan:

- **Stack target:** Nuxt 4 + Vue 3 + Tailwind v4 + shadcn-vue + recharts-vue
- **Database:** SQLite (better-sqlite3) → **PostgreSQL** via **Drizzle ORM** (server sudah ada, tinggal env `DATABASE_URL`)
- **Deploy:** production pakai **Docker**; dev pakai **pnpm dev**
- **Redesign:** layout shadcn dashboard style (sidebar), flow tetap sama
- **Data:** fresh start — re-collect dari GitHub, `data/app.db` lama tidak dimigrasi
- **Arah:** calon product SAAS → struktur pakai konvensi shadcn dashboard; auth/multi-tenant TIDAK dibangun sekarang (YAGNI, bisa ditambah nanti)

**Ukuran:** ~2250 LOC, 42 file. Server logic (`src/server/**`) framework-agnostic.
Beban utama = port React components → Vue + translasi SQL layer → Postgres.

## Approach

Big-bang rewrite di branch `migrate/nuxt`, in-place. Nuxt = Vue, React components
tidak bisa dipakai — semua `src/components/**` (16 file) ditulis ulang. Server
logic dipindah, query SQL ditulis ulang ke target DB.

Mapping arsitektur:

| Next.js | Nuxt.js |
|---|---|
| `src/app/layout.tsx` (nav, font, Toaster, metadata) | `app.vue` + `layouts/default.vue` + `nuxt.config.ts` (`app.head`) |
| `src/app/page.tsx` (dashboard, client) | `pages/index.vue` |
| `src/app/analytics/page.tsx` (server component) | `pages/analytics.vue` + `useAsyncData($fetch('/api/analytics'))` |
| `src/app/pr/[owner]/[repo]/[number]/page.tsx` | `pages/pr/[owner]/[repo]/[number].vue` + API route data |
| `src/app/api/**/route.ts` (7 routes) | `server/api/**` (h3) — `getRouterParam`/`getQuery`/`readBody` |
| `src/server/db/*` (better-sqlite3 + SQL raw) | **Drizzle ORM** + `pg` → `server/services/db/*` |
| `src/server/{github,review,analytics,config}` | `server/services/**` — pindah as-is |
| `src/lib/*` (diff-parser, types, utils) | `utils/` (auto-import) |
| `src/components/ui/*` (11 shadcn) | shadcn-vue (CLI) |
| `src/components/*` (5 app components) | Port manual → SFC |
| `src/components/analytics/charts.tsx` (recharts) | recharts-vue (API ~identik) |
| lucide-react | lucide-vue-next |
| sonner | vue-sonner |
| next-themes / `dark` hardcoded | `@nuxtjs/color-mode` (atau class tetap) |
| next/font (JetBrains Mono) | `@nuxtjs/google-fonts` atau CSS `@import` |
| Tailwind v4 (postcss) | `@tailwindcss/vite` plugin |
| `next.config.ts` `serverExternalPackages` | `nitro.externals` (pi-coding-agent — jangan di-bundle) |
| `npm run dev` / `npm start` | `pnpm dev` / Docker (`.output/server/index.mjs`) |

## Database: SQLite → PostgreSQL

**Keputusan: Drizzle ORM** (`drizzle-orm/pg-core` + `pg` + `drizzle-kit`).
Alasan:
- Migrasi versi ter-manage (`drizzle-kit generate/push`) — penting karena ada server Postgres nyata, schema bakal berevolusi
- Param named object → hapus masalah placeholder (`?` → `$n`) di semua statement
- COUNT/SUM bigint-string otomatis di-cast (`mode: "number"`) — bug laten kalau raw `pg` (recharts dapat string)
- TS-first, cocok stack shadcn/nuxt baru

Alternatif: raw `pg` — lebih dekat bentuk kode sekarang, tapi semua statement kena
ulang manual (`$n`, RETURNING id, bigint cast, tidak ada migrations tooling).

**Inventaris translasi SQL (dari `src/server/db/*` + `analytics.ts`):**

| SQLite sekarang | Postgres |
|---|---|
| `?` / `@named` params | `$n` / objek Drizzle |
| `lastInsertRowid` | `RETURNING id` |
| `datetime('now')` | `now()` |
| `datetime('now', '-15 minutes')` | `now() - interval '15 minutes'` |
| `julianday(a) - julianday(b)` (analytics avg) | `EXTRACT(EPOCH FROM (a - b))/86400.0` |
| `strftime('%Y-W%W', created_at)` (trend) | `to_char(created_at::timestamptz, 'IYYY-"W"IW')` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `serial` / `identity` |
| `is_draft INTEGER 0/1` | `boolean` (row mapper `!!` tetap jalan) |
| `COUNT(*)` → number | bigint string → wajib cast `Number()` |
| `ON CONFLICT ... DO NOTHING/UPDATE` | **syntax sama** — `excluded` identik |
| `COALESCE(MAX(position),-1)+1` | sama |

Kolom timestamp: pertahankan `TEXT` + ISO string (gh kirim ISO; `markReviewSubmitted`
pakai `new Date().toISOString()`) — hindari masalah tipe timestamptz, query trend
cast inline.

**Schema target (`server/services/db/schema.ts` + drizzle-kit migration):**
`repos`, `prs`, `reviews`, `comments` — kolom sama, tipe pg. Migration awal
`0000_initial.sql` generate dari schema.

**Data existing: FRESH + re-collect** (keputusan user). `data/app.db` tidak
dimigrasi — hapus setelah migrasi selesai, lalu boot pertama → klik Refresh
(`POST /api/collect`) untuk isi Postgres dari GitHub. Riwayat review lama
hilang; manual state override juga (bisa di-set ulang via dashboard).
`better-sqlite3` TIDAK dibawa ke deps baru — hanya di branch lama.

## Files to modify

**Buat baru:**
- `nuxt.config.ts` — app.head, css, vite tailwind, `nitro.externals: ["@earendil-works/pi-coding-agent"]`, alias
- `app.vue` / `layouts/default.vue` — layout redesign
- `pages/index.vue`, `pages/analytics.vue`, `pages/pr/[owner]/[repo]/[number].vue`
- `server/api/collect.get.ts` + `.post.ts`
- `server/api/comments/[id].put.ts` + `.delete.ts`
- `server/api/prs/[id]/state.post.ts`
- `server/api/reviews/[id].get.ts` + `.put.ts`
- `server/api/reviews/[id]/comments.post.ts`
- `server/api/reviews/[id]/submit.post.ts`
- `server/api/reviews/run.post.ts` (SSE — `sendStream`/ReadableStream)
- `server/api/analytics.get.ts` (baru)
- `server/api/prs/[owner]/[repo]/[number].get.ts` (baru — gabung pr+reviews+comments+diff, 1 round-trip)
- `server/services/db/{schema,index,prs,repos,reviews}.ts` — Drizzle
- `server/services/{github,review,analytics,config}` — pindah, alias diupdate
- `drizzle.config.ts` + `server/services/db/migrations/`
- `components/**` — shadcn-vue + port app components + charts
- `app/assets/css/main.css` (port globals.css Tailwind v4)
- `utils/diff-parser.ts`, `utils/types.ts`, `utils/utils.ts`
- `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- `.env.example` (`DATABASE_URL=postgres://...`)

**Hapus:** `src/app/**`, `src/components/**` React, `src/server/**` lama,
`next.config.ts`, `next-env.d.ts`, `components.json`, `postcss.config.mjs`,
`public/*.svg`, deps React (`next`, `react`, `react-dom`, `next-themes`,
`better-sqlite3`, `recharts`, `sonner`, `lucide-react`).

## Reuse

- `src/server/github/index.ts` (245 LOC) — pindah as-is, path alias saja
- `src/server/review/{runner,prompt}.ts` — pindah as-is (dynamic import pi agent)
- `src/lib/diff-parser.ts`, `src/lib/types.ts` — framework-agnostic
- `src/server/analytics.ts` — query ditulis ulang ke Drizzle/pg (logika sama)
- Pola query param clamp (`page`/`pageSize`) di `collect/route.ts` → salin ke h3

## Steps

- [ ] 1. Branch `git checkout -b migrate/nuxt`. Setup pnpm. Scaffold Nuxt 4 + Tailwind v4 + shadcn-vue init + recharts-vue + vue-sonner + lucide-vue-next + color-mode.
- [ ] 2. Setup Postgres: `.env` (`DATABASE_URL`), `server/services/db/schema.ts` (Drizzle), `drizzle.config.ts`, generate + push migration `0000_initial`. Hapus `data/app.db` (fresh).
- [ ] 3. Tulis `server/services/db/{prs,repos,reviews}.ts` + `analytics.ts` di atas Drizzle — translasi semua statement (tabel translasi di atas). Hati-hati bigint cast.
- [ ] 4. Pindah `github`, `review`, `config` → `server/services/**`; update import.
- [ ] 5. Port 7 API routes → `server/api/**` h3 (1:1). Tambah 2 route baru (analytics, pr detail).
- [ ] 6. UI primitives: `pnpm dlx shadcn-vue@latest init` + add (button, card, badge, table, dialog, dropdown-menu, select, tabs, textarea, skeleton, sonner). Style "base-nova" mungkin tak didukung → port manual dari file existing sebagai fallback.
- [ ] 7. Port app components → pecah per section kecil (lihat Struktur Komponen): pr-badges → `components/pr/*`, review-thread + review-workspace → `components/review/*` + `composables/useReview.ts`, diff-viewer (329 LOC) → `components/diff/*`. State logic dipindah ke composables; komponen hanya render + emit.
- [ ] 8. Charts: 4 chart recharts → recharts-vue (API sama), pecah per chart di `components/analytics/*`.
- [ ] 9. Halaman: index.vue (client `$fetch`), analytics.vue + pr detail (useAsyncData).
- [ ] 10. Layout redesign: shadcn dashboard style — sidebar (collapsible, `@nuxt/ui`-style atau shadcn-vue sidebar), topbar status, dark theme default, JetBrains Mono. `layouts/default.vue`.
- [ ] 11. Hapus artefak Next + deps React (`better-sqlite3` ikut hapus). Update `.gitignore` (`.nuxt/`, `.output/`, `.env`, hapus `.next/`).
- [ ] 12. Docker: `Dockerfile` (node:22-alpine, corepack pnpm, frozen lockfile, `nuxt build`, `node .output/server/index.mjs`), `.dockerignore`, `docker-compose.yml` (env DATABASE_URL).
- [ ] 13. Boot pertama: `pnpm dev` → klik Refresh → Postgres terisi dari GitHub.

## Verification

- [ ] `pnpm dev` — dashboard load PR dari Postgres
- [ ] Filter repo/state + pagination benar (SQL pagination pg)
- [ ] Refresh collect — `gh` CLI jalan, upsert ke pg (`ON CONFLICT` intact)
- [ ] PR detail: diff render, run review SSE di Nitro, edit/hapus komentar, submit review (422-retry path intact)
- [ ] Analytics: 4 chart render, angka numeric (bukan string — bigint cast ok)
- [ ] Trend query minggu (`IYYY-WIW`) benar
- [ ] `pnpm build` + `node .output/server/index.mjs` jalan
- [ ] `docker compose up` — build image, boot, healthcheck, DB terhubung via env
- [ ] `scripts/diff-parser.test.ts` tetap lulus
- [ ] Sidebar navigasi: Dashboard / Analytics, active state, responsive

## Risiko / Catatan

- **shadcn-vue + Nuxt 4:** issue auto-import/init di beberapa versi; fallback port manual 11 komponen (~400 LOC, kecil).
- **pi-coding-agent:** dynamic import native/wasm → wajib `nitro.externals`, test di build prod.
- **SSE di Nitro:** ReadableStream return works di h3; fallback `sendStream(event, stream)`.
- **COUNT/SUM bigint:** pg return string → semua agregat harus cast `Number()` di Drizzle (`mode: "number"` / `.mapWith`).
- **`process.cwd()`:** tak dipakai lagi (DB di Postgres). `config.json` path → tetap root, atau pindah ke runtimeConfig.
- **Deploy:** Postgres server sudah ada — Docker hanya app image + env DATABASE_URL, tanpa container DB (kecuali mau compose include untuk dev).
- **SAAS:** auth/multi-tenant sengaja TIDAK masuk scope. Konvensi struktur (shadcn dashboard layout, env config, Drizzle migrations) siap untuk itu nanti.

## Struktur Komponen & Clean Code (wajib)

Satu page ≠ satu komponen raksasa. Pecah per section kecil, satu tanggung jawab per komponen, agar mudah maintenance.

**Konvensi folder `components/`:**
- `components/ui/*` — shadcn-vue primitives (tanpa ubah, generic)
- `components/pr/*` — feature-specific per section: `pr-filters.vue`, `pr-pagination.vue`, `pr-table.vue`, `pr-status-badges.vue`, `pr-state-select.vue`
- `components/review/*` — `review-summary.vue`, `review-comment-list.vue`, `review-comment-editor.vue`, `review-submit-button.vue`, `review-status-badge.vue`
- `components/diff/*` — `diff-viewer.vue`, `diff-hunk.vue`, `diff-line.vue` (diff-viewer sekarang 329 LOC satu file → pecah)
- `components/analytics/*` — `analytics-kpis.vue`, `analytics-charts.vue`, per-chart komponen
- `components/dashboard/*` — `dashboard-header.vue`, `dashboard-toolbar.vue` (kalau bukan bagian pr/*)

**Clean code rules:**
- Props/emits typed (TypeScript `defineProps<{...}>()` / `defineEmits<{...}>()`), tidak pakai `any` di interface komponen
- State logic (fetch, pagination, filter, submit flow) → composables di `composables/` (mis. `usePrs.ts`, `useReview.ts`), komponen = render + emit saja
- UI state lokal (loading, open dialog) boleh di komponen; data/business state → composable
- Named exports konsisten, PascalCase file name, satu komponen per file
- Tanpa komponen > ~200 LOC; pecah kalau lewat
- Type shared di `utils/types.ts`, tidak inline di komponen
