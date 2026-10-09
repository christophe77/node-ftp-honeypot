const path = require("path");
const { FtpSrv } = require("ftp-srv");
const { DEFAULTS } = require("./config");
const { createEventLog } = require("./events/eventLog");
const { createPasvResolver } = require("./net/pasv");
const { createQuarantine, QuarantineFileSystem } = require("./fs/quarantineFs");
const { normalizeIp } = require("./utils/sanitize");

// Everything a scanner needs to look around and drop a file. No RETR, no
// DELE, and no PORT/EPRT: active mode would let anyone make us open
// connections to any address (the good old FTP bounce attack).
const ALLOWED_COMMANDS = [
  "USER",
  "PASS",
  "SYST",
  "FEAT",
  "OPTS",
  "NOOP",
  "QUIT",
  "PWD",
  "CWD",
  "CDUP",
  "TYPE",
  "MODE",
  "STRU",
  "PASV",
  "EPSV",
  "LIST",
  "NLST",
  "STOR",
];

// ftp-srv logs a lot through bunyan. We keep our own event log instead.
const silentLogger = {
  child: () => silentLogger,
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};

function createFtpHoneypot(userOptions = {}) {
  const options = { ...DEFAULTS, ...userOptions };
  const events = createEventLog({
    dataDir: options.dataDir,
    onEvent: options.onEvent,
  });
  const quarantine = createQuarantine({
    uploadsDir: path.join(options.dataDir, "uploads"),
    maxFileBytes: options.maxFileBytes,
    maxTotalBytes: options.maxTotalBytes,
  });

  const server = new FtpSrv({
    url: `ftp://${options.host}:${options.port}`,
    pasv_url: createPasvResolver({ publicAddress: options.pasvUrl }),
    pasv_min: options.pasvMin,
    pasv_max: options.pasvMax,
    greeting: options.greeting,
    file_format: "ls",
    whitelist: ALLOWED_COMMANDS,
    timeout: options.idleTimeoutMs,
    log: silentLogger,
  });

  const connectionsPerIp = new Map();

  server.on("connect", ({ connection, id }) => {
    const ip = normalizeIp(connection.ip);
    const session = { session: id, ip };
    const count = (connectionsPerIp.get(ip) || 0) + 1;
    connectionsPerIp.set(ip, count);
    connection.commandSocket.once("close", () => {
      const left = (connectionsPerIp.get(ip) || 1) - 1;
      if (left > 0) connectionsPerIp.set(ip, left);
      else connectionsPerIp.delete(ip);
      events.record("disconnect", session);
    });

    const total = Object.keys(server.connections).length;
    if (count > options.maxConnectionsPerIp || total > options.maxConnections) {
      events.record("connection_refused", {
        ...session,
        reason: "too many connections",
      });
      connection.close(421, "Too many connections").catch(() => {});
      return;
    }
    events.record("connect", session);

    // Log every command the client sends, before ftp-srv even looks at it.
    const { commands } = connection;
    const handle = commands.handle.bind(commands);
    commands.handle = (raw) => {
      const command = typeof raw === "string" ? commands.parse(raw) : raw;
      if (!["USER", "PASS"].includes(command.directive)) {
        events.record("command", {
          ...session,
          directive: command.directive,
          arg: command.arg,
        });
      }
      return handle(command);
    };
  });

  // Every login works. The credentials bots try are the most interesting
  // part of an FTP honeypot, so we keep them, and let them in to see more.
  server.on("login", ({ connection, username, password }, resolve) => {
    const ip = normalizeIp(connection.ip);
    const session = { session: connection.id, ip };
    events.record("login", { ...session, username, password });
    resolve({
      fs: new QuarantineFileSystem(connection, {
        root: options.baitDir,
        quarantine,
        ip,
        events: {
          stored: (upload) =>
            events.record("upload", { ...session, ...upload }),
          reject: (details) =>
            events.record("upload_rejected", { ...session, ...details }),
        },
      }),
    });
  });

  // Errors from a single client must never take the whole server down.
  server.on("client-error", ({ connection, context, error }) => {
    events.record("client_error", {
      session: connection && connection.id,
      ip: connection && normalizeIp(connection.ip),
      context,
      error: error && error.message,
    });
  });
  server.on("server-error", ({ error }) => {
    events.record("server_error", { error: error && error.message });
  });

  return {
    server,
    events,
    quarantine,
    async start() {
      await server.listen();
      return server.server.address();
    },
    async stop() {
      await server.close();
      await events.flush();
    },
  };
}

module.exports = { createFtpHoneypot, ALLOWED_COMMANDS };
