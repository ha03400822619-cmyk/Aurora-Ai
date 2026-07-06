# Use the official Node.js 20-slim image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including production only)
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose port 5000 (which we configured as standard)
EXPOSE 5000

# Set production environment defaults
ENV PORT=5000
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "server.js"]
