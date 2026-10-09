const path = require("path");

// "::ffff:1.2.3.4" is just 1.2.3.4 wearing a disguise.
function normalizeIp(ip) {
  const value = String(ip || "unknown");
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : value;
}

// A directory name that works everywhere. Windows does not like the colons
// of IPv6 addresses, and it used to crash the server on every IPv6 upload.
function ipToDirName(ip) {
  return normalizeIp(ip).replace(/[^\w.-]/g, "_");
}

// Whatever the bot named its file, keep a boring and safe local name.
function sanitizeFileName(name) {
  const base = path.basename(String(name || "").replace(/\\/g, "/"));
  const safe = base
    .replace(/[^\w.-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return safe || "upload";
}

// Computed on every call: it used to be frozen at startup, so every upload
// went into the folder of the day the server was launched.
function today(date = new Date()) {
  return date.toISOString().split("T")[0];
}

module.exports = { normalizeIp, ipToDirName, sanitizeFileName, today };
