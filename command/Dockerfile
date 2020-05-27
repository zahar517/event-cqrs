FROM node:12-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY ./src ./src

RUN npm ci --quiet --only=production

CMD sleep 20 && node /app/src/app.js
