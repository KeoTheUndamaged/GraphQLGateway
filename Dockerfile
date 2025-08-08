# ===================================================================
# GraphQL Gateway - Multi-stage Dockerfile for secure production build
# ===================================================================

# ===================
# STAGE 1: Build Stage
# ===================
FROM node:24-bookworm AS builder

# Set working directory
WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package files first (for better layer caching)
COPY package*.json ./
COPY .npmrc ./

# Install dependencies with exact versions for reproducible builds
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src/ ./src/
COPY supergraph.yaml ./

# Generate supergraph.graphql file
RUN npm run compose

# Build the application
RUN npm run build && \
    npm prune --production

# ===================
# STAGE 2: Production
# ===================
FROM node:24-alpine AS production

# Set working directory
WORKDIR /app

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy only the built application and production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/supergraph.graphql ./

# Security hardening
RUN apk add --no-cache dumb-init && \
    # Remove unnecessary tools
    rm -rf /usr/local/lib/node_modules/npm && \
    # Set proper permissions
    chmod -R 755 /app && \
    # Create a directory for temporary files with proper permissions
    mkdir -p /tmp/app-temp && \
    chown -R nodejs:nodejs /tmp/app-temp

# Use non-root user
USER nodejs

# Set temporary directory to one we have access to
ENV TMPDIR=/tmp/app-temp

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/healthcheck || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]