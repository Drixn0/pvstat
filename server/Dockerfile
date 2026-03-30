FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/pv.db

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "index.js"]
