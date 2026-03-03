FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/agent/package*.json ./
RUN npm install --legacy-peer-deps
COPY apps/agent/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
EXPOSE 8000
ENV NODE_ENV=production
ENV SIMULATION_MODE=true
ENV PORT=8000
CMD ["node", "dist/index.js"]
