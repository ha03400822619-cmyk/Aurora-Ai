# Use the official Node.js 20-slim image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy backend package files first
COPY backend/package*.json ./

# Install dependencies (only production)
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/ .

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Set environment defaults
ENV PORT=7860
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "server.js"]
