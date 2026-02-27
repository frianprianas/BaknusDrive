FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Start Vite server
CMD ["npm", "run", "dev", "--", "--host"]
