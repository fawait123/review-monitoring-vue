# review-monitoring — AGENTS.md

Aplikasi monitor & review GitHub PR berbasis **Nuxt 4.5** (BUKAN Next.js — abaikan template `nextjs-agent-rules`). Build dengan rolldown-vite, DB PostgreSQL via Drizzle, analytics via ClickHouse.

## Stack

- **Framework:** Nuxt 4.5.2, SSR + nitro, `typescript.strict: true`
- **UI:** Vue 3.5, Tailwind CSS 4 (via `@tailwindcss/vite`), shadcn-vue, reka-ui, lucide-vue icons
- **DB:** Drizzle ORM + `pg` (PostgreSQL), schema di `server/services/db/schema.ts`
- **Analytics:** ClickHouse (`@clickhouse/client`)
- **Package manager:** pnpm 11.18.0 (packageManager field pin)

## Commands

```bash
pnpm dev          # dev server
pnpm build        # nuxt build && cp -r server/config .output/server/config
pnpm typecheck    # nuxt typecheck (wajib pass sebelum commit)
pnpm test         # tsx scripts/diff-parser.test.ts
pnpm preview      # preview production build
```

## Struktur

```
app/
  components/        # Vue components
    ui/              # di-auto-import (pathPrefix: false)
    diff/ pr/ review/ analytics/  # components feature — import MANUAL
  composables/       # useX.ts — useReview di-split jadi state/comments/run/submit
  layouts/ pages/ utils/ lib/ assets/
server/
  api/               # nitro routes, file-based (`.get.ts`, `.post.ts`)
  plugins/migrate.ts
  services/
    db/              # Drizzle: client, schema, per-table (prs, repos, reviews, ...)
    github/          # gh.ts (exec gh CLI), repos, prs, reviews + index re-export
    review/          # runner, prompt, utils; panggil gh CLI via server-side
    clickhouse/      # analytics client
    ghAuth.ts, config.ts, model-config-paths.ts
```

## Konvensi & aturan penting

**Import server-side WAJIB pakai alias `#server/`, bukan `~/.`**
- Di server tsconfig, `~/*` map ke `app/*` (client app), bukan `server/`.
- Import service: `import { getPR } from "#server/services/db/prs"` — pakai `~` di file server = TS2307.
- `#shared` = shared types dir, `~~/` = root project (utk file di luar server).

**Import component — jangan andalkan auto-import di luar `~/components/ui`.**
- `nuxt.config.ts` components hanya auto-import `~/components/ui` (pathPrefix: false).
- Komponen non-ui (`pr-table`, `review-workspace`, `GhStatusButton`, `diff-thread-popup`, dll) harus di-import manual via `import X from "~/components/..."`.

**useReview di-split** jadi `useReviewState`, `useReviewComments`, `useReviewRun`, `useReviewSubmit` + facade `useReview.ts`. Setiap composable terima state refs sbg argumen (no shared module state). Tambah logic review: taruh di composable terkait, bukan gabungin ke useReview.ts.

**Build: `server/config` WAJIB di-copy ke .output.**
- Nitro build TIDAK menyalin `server/config` (models.json/auth.json) ke `.output`.
- `build` script sudah handle: `nuxt build && cp -r server/config .output/server/config`.
- Jangan sekadar `nuxt build` tanpa copy.

**gh CLI = server-side only**, native dependency (tidak ada di client/container tanpa gh). Panggil lewat `#server/services/github/gh.ts`.

## Gotchas

- **BSD/macOS sed `-i -E` rusak**: `-E` jadi backup suffix → bikin file `.ts-E*` dan tak edit file. Pakai python utk rewrite massal, atau `sed -i '' -e ...`.
- **Nitro external**: `@earendil-works/pi-coding-agent` di-external (native/wasm), jangan di-bundle.
- **env**: runtime butuh `DATABASE_URL`; Docker Desktop VM default 2GB → OOM (EXIT 137) saat build besar.
- **Typecheck** harus clean sebelum commit (strict: true).
