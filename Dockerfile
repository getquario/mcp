FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
ENTRYPOINT ["node", "lib/bin.js"]
