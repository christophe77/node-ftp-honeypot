const path = require("path");

const env = (name, fallback) =>
  process.env[name] !== undefined && process.env[name] !== ""
    ? process.env[name]
    : fallback;

const number = (name, fallback) => Number(env(name, fallback));

const MB = 1024 * 1024;

const DEFAULTS = {
  host: "0.0.0.0",
  // 2121, not 21: ports below 1024 need root, and a server whose job is to
  // receive malware has no business running as root. Map 21 to it instead.
  port: 2121,
  // Public IP or hostname announced in PASV replies. Set it in production.
  pasvUrl: null,
  pasvMin: 50000,
  pasvMax: 50100,
  dataDir: path.join(__dirname, "..", "pandora-box"),
  baitDir: path.join(__dirname, "..", "black-box", "ftp"),
  greeting: "Welcome to VOFTP a very open FTP Server.",
  maxFileBytes: 10 * MB,
  maxTotalBytes: 1024 * MB,
  maxConnections: 100,
  maxConnectionsPerIp: 5,
  idleTimeoutMs: 60 * 1000,
  onEvent: null,
};

function fromEnv() {
  return {
    host: env("FTP_HOST", DEFAULTS.host),
    port: number("FTP_PORT", DEFAULTS.port),
    pasvUrl: env("PASV_URL", DEFAULTS.pasvUrl),
    pasvMin: number("PASV_MIN", DEFAULTS.pasvMin),
    pasvMax: number("PASV_MAX", DEFAULTS.pasvMax),
    dataDir: env("DATA_DIR", DEFAULTS.dataDir),
    baitDir: env("BAIT_DIR", DEFAULTS.baitDir),
    greeting: env("FTP_GREETING", DEFAULTS.greeting),
    maxFileBytes: number("MAX_FILE_MB", DEFAULTS.maxFileBytes / MB) * MB,
    maxTotalBytes: number("MAX_TOTAL_MB", DEFAULTS.maxTotalBytes / MB) * MB,
    maxConnections: number("MAX_CONNECTIONS", DEFAULTS.maxConnections),
    maxConnectionsPerIp: number(
      "MAX_CONNECTIONS_PER_IP",
      DEFAULTS.maxConnectionsPerIp
    ),
    idleTimeoutMs: number("IDLE_TIMEOUT_MS", DEFAULTS.idleTimeoutMs),
  };
}

module.exports = { DEFAULTS, fromEnv };
