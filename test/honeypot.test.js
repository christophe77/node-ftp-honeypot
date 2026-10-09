const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const ftp = require("basic-ftp");
const { createFtpHoneypot } = require("../src/honeypot");
const { today } = require("../src/utils/sanitize");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftp-honeypot-data-"));
const baitDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftp-honeypot-bait-"));
fs.writeFileSync(path.join(baitDir, "backup.sql"), "-- nothing to see here");

let honeypot;
let port;
const events = [];

before(async () => {
  honeypot = createFtpHoneypot({
    host: "127.0.0.1",
    port: 0,
    pasvUrl: "127.0.0.1",
    pasvMin: 52000,
    pasvMax: 52100,
    dataDir,
    baitDir,
    maxFileBytes: 1024,
    maxTotalBytes: 3000,
    maxConnectionsPerIp: 3,
    onEvent: (event) => events.push(event),
  });
  ({ port } = await honeypot.start());
});

after(async () => {
  await honeypot.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(baitDir, { recursive: true, force: true });
});

async function connect(user = "admin", password = "admin123") {
  const client = new ftp.Client(5000);
  await client.access({ host: "127.0.0.1", port, user, password });
  return client;
}

const of = (type) => events.filter((e) => e.type === type);

test("every login is accepted and the credentials are logged", async () => {
  const client = await connect("root", "toor");
  client.close();
  const login = of("login").find((e) => e.username === "root");
  assert.ok(login);
  assert.strictEqual(login.password, "toor");
  assert.strictEqual(login.ip, "127.0.0.1");
});

test("uploads go to quarantine, with a hash, never into the bait dir", async () => {
  const client = await connect();
  await client.uploadFrom(
    Readable.from(["<?php evil(); ?>"]),
    "../../evil.php"
  );
  const listing = (await client.list()).map((f) => f.name);
  client.close();

  assert.deepStrictEqual(listing, ["backup.sql"]);
  assert.ok(!fs.existsSync(path.join(baitDir, "evil.php")));

  const upload = of("upload").at(-1);
  assert.strictEqual(upload.size, 16);
  assert.match(upload.sha256, /^[a-f0-9]{64}$/);
  assert.ok(upload.file.startsWith(path.join(today(), "127.0.0.1")));
  assert.ok(upload.file.endsWith("-evil.php"));
  const stored = path.join(dataDir, "uploads", upload.file);
  assert.strictEqual(fs.readFileSync(stored, "utf8"), "<?php evil(); ?>");
});

test("oversized uploads are rejected and the server keeps running", async () => {
  const client = await connect();
  await assert.rejects(
    client.uploadFrom(Readable.from([Buffer.alloc(5000)]), "big.bin")
  );
  client.close();
  assert.strictEqual(of("upload_rejected").at(-1).reason, "file too large");

  const again = await connect();
  assert.ok((await again.list()).length >= 1);
  again.close();
});

test("an upload cut in the middle does not crash anything", async () => {
  const client = await connect();
  const endless = new Readable({
    read() {
      setTimeout(() => this.push(Buffer.alloc(100)), 20);
    },
  });
  const upload = client.uploadFrom(endless, "slow.bin").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 100));
  client.close();
  await upload;

  const again = await connect();
  assert.ok((await again.list()).length >= 1);
  again.close();
});

test("downloads, deletes and renames are refused", async () => {
  const client = await connect();
  await assert.rejects(
    client.downloadTo(new (require("stream").PassThrough)(), "backup.sql")
  );
  await assert.rejects(client.remove("backup.sql"));
  await assert.rejects(client.rename("backup.sql", "x.sql"));
  client.close();
  assert.ok(fs.existsSync(path.join(baitDir, "backup.sql")));
});

test("the global quota is enforced", async () => {
  const client = await connect();
  let rejected = false;
  for (let i = 0; i < 6 && !rejected; i += 1) {
    try {
      await client.uploadFrom(
        Readable.from([Buffer.alloc(900, i)]),
        `f${i}.bin`
      );
    } catch (e) {
      rejected = true;
    }
  }
  client.close();
  assert.ok(rejected);
  assert.strictEqual(of("upload_rejected").at(-1).reason, "quota exceeded");
});

test("too many connections from one IP are refused", async () => {
  const clients = [];
  for (let i = 0; i < 3; i += 1) clients.push(await connect());
  await assert.rejects(connect());
  clients.forEach((c) => c.close());
  assert.ok(of("connection_refused").length >= 1);
});

test("everything is written to the daily jsonl event log", async () => {
  await honeypot.events.flush();
  const logFile = path.join(dataDir, "events", `${today()}.jsonl`);
  const lines = fs
    .readFileSync(logFile, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const types = new Set(lines.map((l) => l.type));
  for (const type of ["connect", "login", "command", "upload", "disconnect"]) {
    assert.ok(types.has(type), type);
  }
});
