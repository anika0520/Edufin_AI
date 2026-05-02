# frontend/Dockerfile — Multi-stage production build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
ARG VITE_API_URL=https://api.FutureFin.ai/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Nginx serving optimized static files
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Security-hardened nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
