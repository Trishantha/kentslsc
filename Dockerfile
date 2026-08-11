FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.js ./server.js
EXPOSE 3000 3001
CMD ["node", "server.js"]
