const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Writable } = require("stream");
const { FileSystem } = require("ftp-srv");
const { ipToDirName, sanitizeFileName, today } = require("../utils/sanitize");

class PermissionError extends Error {
  constructor(message = "Permission denied") {
    super(message);
    this.code = 550;
  }
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return total + directorySize(entryPath);
    return total + fs.statSync(entryPath).size;
  }, 0);
}

// Shared by every connection: where uploads go and how much room is left.
function createQuarantine({ uploadsDir, maxFileBytes, maxTotalBytes }) {
  const incomingDir = path.join(uploadsDir, ".incoming");
  fs.mkdirSync(incomingDir, { recursive: true });
  // Leftovers from a previous run that died mid upload.
  fs.readdirSync(incomingDir).forEach((file) =>
    fs.rmSync(path.join(incomingDir, file), { force: true })
  );
  // pendingBytes counts uploads in progress, so parallel uploads can't all
  // squeeze under the quota at the same time.
  const state = { usedBytes: directorySize(uploadsDir), pendingBytes: 0 };
  return { uploadsDir, incomingDir, maxFileBytes, maxTotalBytes, state };
}

// Writes an upload to a temp file while hashing it and counting bytes, then
// moves it to <uploads>/<date>/<ip>/<sha256 prefix>-<name> once complete.
class QuarantineStream extends Writable {
  constructor({ quarantine, ip, clientPath, onStored, onRejected }) {
    super();
    this.quarantine = quarantine;
    this.ip = ip;
    this.clientPath = clientPath;
    this.onStored = onStored;
    this.onRejected = onRejected;
    this.bytes = 0;
    this.hash = crypto.createHash("sha256");
    this.tmpPath = path.join(
      quarantine.incomingDir,
      `${crypto.randomUUID()}.part`
    );
    this.file = fs.createWriteStream(this.tmpPath);
    this.file.on("error", (err) => this.destroy(err));
    // ftp-srv emits "close" on the stream instead of ending it when the
    // data socket ends. Without this, the upload would hang forever.
    this.once("close", () => {
      if (!this.writableEnded && !this.destroyed) this.end();
    });
  }

  _write(chunk, encoding, callback) {
    const { maxFileBytes, maxTotalBytes, state } = this.quarantine;
    this.bytes += chunk.length;
    state.pendingBytes += chunk.length;
    if (this.bytes > maxFileBytes) {
      return callback(this.reject("file too large"));
    }
    if (state.usedBytes + state.pendingBytes > maxTotalBytes) {
      return callback(this.reject("quota exceeded"));
    }
    this.hash.update(chunk);
    if (this.file.write(chunk)) return callback();
    return this.file.once("drain", callback);
  }

  _final(callback) {
    // Wait for "close", not "finish": Windows refuses to rename a file
    // whose handle is still open.
    this.file.once("close", () => {
      this.store().then(() => callback(), callback);
    });
    this.file.end();
  }

  async store() {
    const sha256 = this.hash.digest("hex");
    const day = today();
    const dir = path.join(
      this.quarantine.uploadsDir,
      day,
      ipToDirName(this.ip)
    );
    const fileName = `${sha256.slice(0, 12)}-${sanitizeFileName(this.clientPath)}`;
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.rename(this.tmpPath, path.join(dir, fileName));
    this.release();
    this.quarantine.state.usedBytes += this.bytes;
    this.onStored({
      clientPath: this.clientPath,
      file: path.join(day, ipToDirName(this.ip), fileName),
      size: this.bytes,
      sha256,
    });
  }

  reject(reason) {
    this.onRejected({ clientPath: this.clientPath, reason, bytes: this.bytes });
    return new PermissionError(`Upload rejected: ${reason}`);
  }

  // Gives back the room reserved by this upload, exactly once.
  release() {
    if (this.released) return;
    this.released = true;
    this.quarantine.state.pendingBytes -= this.bytes;
  }

  _destroy(err, callback) {
    this.release();
    this.file.destroy();
    fs.rm(this.tmpPath, { force: true }, () => callback(err));
  }
}

// What the bots see: the read only bait directory. What they get: every
// upload goes straight to quarantine, never into the directory they can list.
class QuarantineFileSystem extends FileSystem {
  constructor(connection, { root, quarantine, ip, events }) {
    super(connection, { root, cwd: "/" });
    this.quarantine = quarantine;
    this.ip = ip;
    this.events = events;
  }

  write(fileName) {
    const { clientPath } = this._resolvePath(fileName);
    const { state, maxTotalBytes } = this.quarantine;
    if (state.usedBytes + state.pendingBytes >= maxTotalBytes) {
      this.events.reject({ clientPath, reason: "quota exceeded", bytes: 0 });
      throw new PermissionError("Upload rejected: quota exceeded");
    }
    const stream = new QuarantineStream({
      quarantine: this.quarantine,
      ip: this.ip,
      clientPath,
      onStored: this.events.stored,
      onRejected: this.events.reject,
    });
    return { stream, clientPath };
  }

  read() {
    throw new PermissionError();
  }

  delete() {
    throw new PermissionError();
  }

  mkdir() {
    throw new PermissionError();
  }

  rename() {
    throw new PermissionError();
  }

  chmod() {
    throw new PermissionError();
  }
}

module.exports = { createQuarantine, QuarantineFileSystem, PermissionError };
