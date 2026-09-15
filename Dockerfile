# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install all deps (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Railway injects PORT; default to 3000
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck — Railway also checks /health via railway.json
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
