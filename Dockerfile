FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache openssl && corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN mkdir -p apps/web/public && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Placeholder values are sufficient for the build stage; real deployments inject
# their own environment files at runtime. NEXT_PUBLIC_API_URL is baked into the
# client bundle, so it must be present during the build.
ENV FRONTEND_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=http://localhost:3000
ENV API_PROXY_TARGET=http://localhost:3000
ENV NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
ENV WEB_BUILD_NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm build

FROM base AS runtime
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/apps/web/server-handler.js ./apps/web/server-handler.js
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml

# The runtime still needs the installed dependency tree. It is copied in a single
# layer from the deps stage so pnpm can resolve workspace links.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Run as a non-root user for security and to avoid permission surprises on shared
# hosting-style containers.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
