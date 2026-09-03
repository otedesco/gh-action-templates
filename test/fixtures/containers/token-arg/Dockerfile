FROM node:24.20.0-alpine
ARG NPM_TOKEN
RUN --mount=type=secret,id=npm_token,required=true pnpm install --frozen-lockfile
USER node
HEALTHCHECK CMD true
