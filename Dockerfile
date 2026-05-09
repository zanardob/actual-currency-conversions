FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN mkdir -p ./actual-cache && \
    npm ci --omit=dev

COPY . .

CMD ["npm", "run", "schedule"]
