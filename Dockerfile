FROM node:26-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY scripts/database-copy.js ./scripts/database-copy.js
ENV NODE_ENV=production HOST=0.0.0.0 SQLITE_PATH=/data/uramaku.sqlite
EXPOSE 3000
# /data is supplied by the Railway persistent volume. It is deliberately not
# created in the image, so a missing mount fails rather than saving ephemeral games.
CMD ["node", "server/index.js"]
