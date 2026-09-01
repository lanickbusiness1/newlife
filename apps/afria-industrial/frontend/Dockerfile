FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./package.json
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run typecheck && npm test -- --run && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
