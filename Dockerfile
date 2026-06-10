FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
RUN addgroup -g 1001 app && adduser -D -u 1001 -G app app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=app:app . .
RUN mkdir -p /app/data && chown -R app:app /app/data
USER app
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
