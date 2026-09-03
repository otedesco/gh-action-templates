# syntax=docker/dockerfile:1.7
FROM node:24.20.0-alpine AS installer
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npm_token,required=true NPM_TOKEN="$(cat /run/secrets/npm_token)" pnpm install --frozen-lockfile && rm .npmrc
FROM installer AS builder
COPY . .
RUN pnpm run build && pnpm prune --prod
FROM node:24.20.0-alpine AS production
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
HEALTHCHECK CMD node -e "process.exit(0)"
CMD ["dist/index.js"]
