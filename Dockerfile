FROM node:22-alpine AS build
RUN corepack enable
# heap cap — bantu CI memori kecil. Catatan: Docker Desktop VM default 2GB MASIH OOM saat
# rolldown-vite transform (klien Nuxt 4.5). Naikkan ke >=4GB (Settings -> Resources -> Memory).
ENV NODE_OPTIONS=--max-old-space-size=1536
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
RUN corepack enable
# gh CLI — server pakai `gh` utk collect/diff/review.
# Tidak tersedia di repo Alpine → unduh release tarball resmi (pin versi = dev machine 2.96.0).
ARG TARGETARCH
# DNS Alpine kadang transient di CI — retry 3x; busybox wget: -t retries, -T timeout
RUN (apk add --no-cache ca-certificates || apk add --no-cache ca-certificates || apk add --no-cache ca-certificates) && \
    arch=$( [ "$TARGETARCH" = "arm64" ] && echo arm64 || echo amd64 ) && \
    wget -t 3 -T 30 -q https://github.com/cli/cli/releases/download/v2.96.0/gh_2.96.0_linux_${arch}.tar.gz -O /tmp/gh.tar.gz && \
    tar -xzf /tmp/gh.tar.gz -C /tmp && \
    mv /tmp/gh_2.96.0_linux_${arch}/bin/gh /usr/local/bin/gh && \
    rm -rf /tmp/gh_2.96.0_linux_${arch} /tmp/gh.tar.gz
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
# migration SQL dibutuhkan saat boot (plugin migrate.ts)
COPY --from=build /app/server/services/db/migrations ./.output/server/services/db/migrations
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
