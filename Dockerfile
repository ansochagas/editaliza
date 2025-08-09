# Stage 1: Build dependencies
# Use a specific Node.js version for reproducibility.
FROM node:18.17.0-alpine AS dependencies

WORKDIR /app

# Install dumb-init, a lightweight init system for containers
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies
# Using 'ci' ensures a clean, consistent install based on package-lock.json
RUN npm ci --only=production

# Stage 2: Production image
# Use the same base image for consistency
FROM node:18.17.0-alpine AS production

# Create a non-root user for security
RUN addgroup -S nonroot && adduser -S nonroot -G nonroot

WORKDIR /app

# Copy pre-installed dependencies and dumb-init from the 'dependencies' stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /usr/bin/dumb-init /usr/bin/dumb-init

# Copy the rest of the application code
# This includes server.js, middleware.js, src/, html files, etc.
COPY . .

# Switch to the non-root user
USER nonroot

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port the app runs on
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]