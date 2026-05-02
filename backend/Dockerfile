FROM node:18-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Create logs directory
RUN mkdir -p logs

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S edufin -u 1001 && \
    chown -R edufin:nodejs /app
USER edufin

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
