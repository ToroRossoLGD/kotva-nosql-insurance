FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY warehouse.js ./
COPY warehouse ./warehouse
COPY public ./public
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
