FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create directory for Actual API cache and exchange rate cache
RUN mkdir -p ./actual-cache

# Run scheduler daemon (runs daily at 00:00 UTC)
CMD ["npm", "run", "schedule"]
