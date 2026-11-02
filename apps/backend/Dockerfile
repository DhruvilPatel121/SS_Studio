FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ vips-dev

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache vips
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 4000
CMD ["node", "dist/server.js"]