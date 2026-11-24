FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data

EXPOSE 3000
# Credits are written back to data/users.json; mount a volume there to keep them across container restarts.
CMD ["node", "src/server.js"]
