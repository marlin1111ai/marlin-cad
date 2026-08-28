# syntax=docker/dockerfile:1

# Production image for SketchForge (apps/web).
#
# Two notes that are easy to get wrong here:
#   - next.config.ts only switches to `output: "standalone"` when
#     SKETCHFORGE_DOCKER_BUILD=true, so the builder stage must set it.
#   - The OCCT kernel (Emscripten glue + ~22 MB .wasm) is staged into
#     apps/web/public/occt/ by the `prebuild` hook and loaded at runtime via a
#     webpackIgnore dynamic import. Standalone output does not carry public/
#     across, so it is copied explicitly below.

FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKETCHFORGE_DOCKER_BUILD=true
# electron/electron-builder are devDependencies of the desktop app and play no
# part in the web build; skip the ~100 MB binary download.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `prebuild` stages apps/web/public/occt/ before `next build` runs.
RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
