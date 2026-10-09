FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY bin ./bin
COPY src ./src
COPY black-box ./black-box

# Events and captured uploads live here, mount a volume to keep them.
ENV DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

# The honeypot stores malware. It does not need to be root to do it.
USER node

ENV FTP_PORT=2121 \
    PASV_MIN=50000 \
    PASV_MAX=50100 \
    IGNORE_IPS=127.0.0.1
EXPOSE 2121 50000-50100

# Connects to the control port. 127.0.0.1 is in IGNORE_IPS, so the
# healthcheck does not end up in the event log every 30 seconds.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('net').connect(process.env.FTP_PORT,'127.0.0.1').on('connect',function(){this.destroy();process.exit(0)}).on('error',()=>process.exit(1))"

CMD ["node", "bin/cli.js"]
