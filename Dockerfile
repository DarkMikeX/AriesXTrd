# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p database logs config

# Set proper permissions
RUN chmod +x src/app.js
RUN chmod 755 database logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S tradingbot -u 1001

# Change ownership of app directory
RUN chown -R tradingbot:nodejs /app
USER tradingbot

# Expose port (if using web interface)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./src/app.js')" || exit 1

# Start the application
CMD ["npm", "start"]