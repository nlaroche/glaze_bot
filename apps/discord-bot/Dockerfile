FROM node:20-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/discord-bot/ apps/discord-bot/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @glazebot/discord-bot build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules node_modules/
COPY --from=build /app/packages packages/
COPY --from=build /app/apps/discord-bot/dist apps/discord-bot/dist/
COPY --from=build /app/apps/discord-bot/package.json apps/discord-bot/package.json

WORKDIR /app/apps/discord-bot
CMD ["node", "dist/index.js"]
