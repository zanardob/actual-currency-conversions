FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir ./actual-cache

CMD ["npm", "run", "convert"]
