# ================================
# Server Dockerfile (multi-stage)
# ================================
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl python3 py3-pip
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install prisma@5.22.0
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY src/prisma ./src/prisma

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
