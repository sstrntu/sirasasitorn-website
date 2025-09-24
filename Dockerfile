# Build frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Allow passing CRA env vars at build time
ARG OPENAI_API
ENV REACT_APP_OPENAI_API=$OPENAI_API

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY src ./src
COPY public ./public

RUN npm run build

# Install backend dependencies
FROM node:18-alpine AS backend-build

WORKDIR /backend

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/. ./

# Production runtime
FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY --from=backend-build /backend ./backend
COPY --from=frontend-build /app/build ./build

EXPOSE 8080

CMD ["node", "backend/server.js"]
