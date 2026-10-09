const { test } = require("node:test");
const assert = require("node:assert");
const {
  normalizeIp,
  ipToDirName,
  sanitizeFileName,
  today,
} = require("../src/utils/sanitize");

test("IPv4 mapped addresses are unwrapped", () => {
  assert.strictEqual(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.strictEqual(normalizeIp("2001:db8::1"), "2001:db8::1");
});

test("IP directory names are safe on Windows", () => {
  assert.strictEqual(ipToDirName("::ffff:203.0.113.7"), "203.0.113.7");
  assert.strictEqual(ipToDirName("2001:db8::1"), "2001_db8__1");
  assert.ok(!/[:\\/]/.test(ipToDirName("fe80::1%eth0")));
});

test("uploaded file names cannot escape or hide", () => {
  assert.strictEqual(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.strictEqual(sanitizeFileName("..\\..\\boot.ini"), "boot.ini");
  assert.strictEqual(sanitizeFileName(".bashrc"), "bashrc");
  assert.strictEqual(sanitizeFileName("we ird$name.php"), "we_ird_name.php");
  assert.strictEqual(sanitizeFileName(""), "upload");
});

test("the date is computed when asked, not at startup", () => {
  assert.strictEqual(today(new Date("2024-02-29T23:59:59Z")), "2024-02-29");
  assert.strictEqual(today(new Date("2024-03-01T00:00:00Z")), "2024-03-01");
});
