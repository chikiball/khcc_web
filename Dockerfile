# syntax=docker/dockerfile:1.7

# ---------- Base ----------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Builder ----------
FROM base AS builder
# Only NEXT_PUBLIC_* values are inlined into client bundles; pass them as ARG.
# Server-only secrets (AUTH_SECRET, AUTH_GOOGLE_SECRET, DATABASE_URL,
# POSTGRES_PASSWORD) come in at runtime — never via build args.
ARG NEXT_PUBLIC_SITE_URL
ARG AUTH_GOOGLE_ID
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_GOOGLE_ID=${AUTH_GOOGLE_ID}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone bundle (small) + static assets + public
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Drizzle migration assets — needed by `drizzle-kit migrate` at startup.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
# Source needed by one-off scripts (seed, send-test-email, etc). The
# production app itself uses /.next/standalone — these files are for
# `tsx scripts/...` invocations.
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
# drizzle-kit + tsx must be available at runtime to execute migrations
# and one-off scripts (seed, etc.). We copy the package directories only —
# the `.bin/` symlinks get dereferenced incorrectly by Docker COPY, so we
# always call these via their direct entry-point paths instead:
#   node ./node_modules/drizzle-kit/bin.cjs migrate
#   node ./node_modules/tsx/dist/cli.mjs scripts/<name>.ts
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx

COPY --chown=nextjs:nodejs docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
