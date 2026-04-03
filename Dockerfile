FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Create necessary directories
RUN mkdir -p data logs backups

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
