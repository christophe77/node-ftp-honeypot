const { createFtpHoneypot } = require("./src/honeypot");
const { fromEnv } = require("./src/config");

const config = fromEnv();

const honeypot = createFtpHoneypot({
  ...config,
  onEvent: (event) => {
    if (event.type === "login") {
      console.log(`🔑 ${event.ip} tried ${event.username} / ${event.password}`);
    } else if (event.type === "upload") {
      console.log(
        `📦 ${event.ip} uploaded ${event.clientPath} (${event.size} bytes, sha256 ${event.sha256})`
      );
    }
  },
});

honeypot
  .start()
  .then(({ port }) => {
    console.log(`🍯 ftp honeypot listening on port ${port}`);
    if (!config.pasvUrl) {
      console.warn(
        "PASV_URL is not set: passive mode will announce a local address. " +
          "Set it to your public IP when exposing the honeypot to the internet."
      );
    }
  })
  .catch((err) => {
    console.error(`Cannot start the ftp honeypot: ${err.message}`);
    process.exit(1);
  });

// A honeypot is meant to stay up. Log anything that slips through.
process.on("unhandledRejection", (reason) => {
  console.error("ftp-honeypot: unhandled rejection:", reason);
});
