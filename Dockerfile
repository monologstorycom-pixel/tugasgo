FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

FROM deps AS build
COPY . .
ARG VITE_API_URL=https://tugasgo.rsby.cloud/api
ARG VITE_WS_URL=wss://tugasgo.rsby.cloud/ws
ARG VITE_GOOGLE_MAPS_KEY
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
RUN npm run build

FROM nginx:1.27-alpine AS frontend
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production PORT=3001 GCS_KEY_FILE=/app/secrets/gcs-key.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY docker-entrypoint.sh ./
RUN mkdir -p /app/secrets && chmod 755 /app/docker-entrypoint.sh
EXPOSE 3001
CMD ["/app/docker-entrypoint.sh"]
