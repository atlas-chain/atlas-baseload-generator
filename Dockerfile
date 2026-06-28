FROM oven/bun:1.3.14-alpine

WORKDIR /app

ARG BUILD_COMMIT=unknown
ARG BUILD_DATE=unknown

COPY package.json ./
RUN bun install

COPY tsconfig.json ./
COPY llms.txt ./
COPY src ./src

ENV NODE_ENV=production
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}
ENV SERVER_PORT=3000
ENV SERVER_HOSTNAME=0.0.0.0
ENV BASELOAD_CONFIG_DIR=/app/baseload-config

EXPOSE 3000

CMD ["bun", "run", "serve"]
