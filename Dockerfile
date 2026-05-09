FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN mkdir -p ./actual-cache && \
    npm ci

COPY . .

CMD ["npm", "run", "schedule"]
