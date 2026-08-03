# --- build stage ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
# Keep this tag aligned with the Playwright version in package-lock.json.
# The image includes Chromium and its Linux system dependencies, which the
# snapshot/import pipeline needs at runtime.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER pwuser
CMD ["node", "dist/index.js"]
