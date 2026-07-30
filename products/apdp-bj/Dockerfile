FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN npm run test && npm run typecheck && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-web ./dist-web
EXPOSE 3001
CMD ["node", "dist/apps/api/src/server.js"]
