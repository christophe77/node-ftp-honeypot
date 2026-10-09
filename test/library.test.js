const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ftp = require("basic-ftp");

test("requiring the package does not start a server", () => {
  const lib = require("../src/index");
  assert.strictEqual(typeof lib.createFtpHoneypot, "function");
  assert.ok(lib.ALLOWED_COMMANDS.includes("STOR"));
  assert.ok(!lib.ALLOWED_COMMANDS.includes("PORT"));
  assert.strictEqual(lib.DEFAULTS.port, 2121);
});

test("connections from ignored IPs are served but not logged", async () => {
  const { createFtpHoneypot } = require("../src/index");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ftp-honeypot-ign-"));
  const events = [];
  const honeypot = createFtpHoneypot({
    host: "127.0.0.1",
    port: 0,
    pasvUrl: "127.0.0.1",
    pasvMin: 52200,
    pasvMax: 52300,
    dataDir,
    ignoreIps: ["127.0.0.1"],
    onEvent: (event) => events.push(event),
  });
  const { port } = await honeypot.start();
  try {
    const client = new ftp.Client(5000);
    await client.access({ host: "127.0.0.1", port, user: "me", password: "x" });
    const listing = await client.list();
    client.close();
    // The default bait is served.
    assert.ok(listing.some((f) => f.name === "wp-config.php.bak"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepStrictEqual(events, []);
  } finally {
    await honeypot.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("the default bait files contain the default honeytokens", () => {
  const { DEFAULTS } = require("../src/index");
  const bait = [
    "wp-config.php.bak",
    path.join("backup", "db_backup_2019.sql"),
  ].map((file) => fs.readFileSync(path.join(DEFAULTS.baitDir, file), "utf8"));
  for (const token of DEFAULTS.honeytokens) {
    assert.ok(
      bait.some((content) => content.includes(token)),
      token
    );
  }
});
