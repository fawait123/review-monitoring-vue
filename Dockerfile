FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
RUN corepack enable
# gh CLI — server pakai `gh` utk collect/diff/review
RUN apk add --no-cache gh
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
# migration SQL dibutuhkan saat boot (plugin migrate.ts)
COPY --from=build /app/server/services/db/migrations ./.output/server/services/db/migrations
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
