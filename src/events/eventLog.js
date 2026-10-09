const fs = require("fs/promises");
const path = require("path");
const { today } = require("../utils/sanitize");

// Every connection, login, command and upload ends up as one JSON line in
// <dataDir>/events/YYYY-MM-DD.jsonl. Easy to grep, easy to ship to a SIEM.
function createEventLog({ dataDir, onEvent, console: out = console }) {
  const eventsDir = path.join(dataDir, "events");
  // Appends are serialized so lines never interleave.
  let queue = Promise.resolve();

  function record(type, fields = {}) {
    const event = { ts: new Date().toISOString(), type, ...fields };
    const line = `${JSON.stringify(event)}\n`;
    const filePath = path.join(eventsDir, `${today()}.jsonl`);

    queue = queue
      .then(() => fs.mkdir(eventsDir, { recursive: true }))
      .then(() => fs.appendFile(filePath, line))
      .catch((err) =>
        out.error(`ftp-honeypot: cannot write event: ${err.message}`)
      );

    if (typeof onEvent === "function") {
      try {
        onEvent(event);
      } catch (err) {
        out.error(`ftp-honeypot: onEvent failed: ${err.message}`);
      }
    }
    return event;
  }

  // Resolves once everything recorded so far is on disk.
  const flush = () => queue;

  return { record, flush };
}

module.exports = { createEventLog };
