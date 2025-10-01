# Build frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Set production environment variables directly
ENV REACT_APP_API_URL=""
ENV REACT_APP_SUPABASE_URL="https://epclbvqatdyhybukzsme.supabase.co"
ENV REACT_APP_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwY2xidnFhdGR5aHlidWt6c21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyOTA4NTksImV4cCI6MjA3NDg2Njg1OX0.QqkVyPXKCvsU_4oK8QANl9h6s7LDtT3JXCFihCtWTXc"

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

EXPOSE 3007

CMD ["node", "backend/server.js"]
