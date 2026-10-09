# 📡 node-ftp-honeypot

[![Tests](https://github.com/christophe77/node-ftp-honeypot/actions/workflows/test.yml/badge.svg)](https://github.com/christophe77/node-ftp-honeypot/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/christophe77/node-ftp-honeypot)](LICENSE)

An FTP honeypot written in Node.js, on top of [ftp-srv](https://github.com/autovance/ftp-srv).

Bots scan the internet for open FTP servers, try default credentials and drop files: web shells, miners, botnet droppers. node-ftp-honeypot lets every one of them in, writes down everything they do, and keeps what they upload in quarantine.

- 🔑 **Every login works**, and every username / password tried is logged
- 📦 **Uploads are quarantined** with a sha256, never stored where other clients can see them
- 📝 **Every connection and command** goes to a daily JSON lines log
- 🎣 **Bait files with honeytokens**: a fake `wp-config.php.bak` and an old SQL dump. When a bot logs in with a password it could only have found there, you know it took the bait
- 🛡️ **Nothing real to steal or break**: downloads limited to the bait, no deletes, no active mode, size and quota limits

Sibling project: [express-honeypot](https://github.com/christophe77/express-honeypot), the same idea for web RFI/LFI bots 🍯

## 🐳 Quick start with Docker

```bash
docker run -d -p 21:2121 -p 50000-50100:50000-50100 -e PASV_URL=<your public ip> -v pandora:/data ghcr.io/christophe77/node-ftp-honeypot
```

Or with the provided [docker-compose.yml](docker-compose.yml) (read only filesystem, no capabilities, non root user). Events and uploads end up in the `/data` volume.

On Docker Desktop (Windows / macOS), every client shows up with the IP of the Docker gateway. Run it on a Linux host to see the real attacker IPs.

## 🧩 As a library

```bash
npm install node-ftp-honeypot
```

```js
const { createFtpHoneypot } = require("node-ftp-honeypot");

const honeypot = createFtpHoneypot({
  pasvUrl: "203.0.113.10",
  onEvent: (event) => {
    if (event.type === "login" && event.honeytoken) {
      console.warn(`🚨 ${event.ip} came back with the password from the bait files`);
    }
  },
});

await honeypot.start();
```

Every option of the configuration table below is available, in camelCase (`maxFileBytes`, `ignoreIps`, `honeytokens`, `baitDir`...).

## 🛠️ From source

```bash
git clone https://github.com/christophe77/node-ftp-honeypot
cd node-ftp-honeypot
npm install
npm start
```

The honeypot listens on port **2121**. To expose it as a real FTP server, forward port 21 to it rather than running Node as root:

```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 21 -j REDIRECT --to-port 2121
```

Also open the passive port range (50000 to 50100 by default) and set `PASV_URL` to your public IP.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `FTP_PORT` | `2121` | Control port |
| `FTP_HOST` | `0.0.0.0` | Listening address |
| `PASV_URL` | none | Public IP or hostname announced in passive mode. **Set it in production** |
| `PASV_MIN` / `PASV_MAX` | `50000` / `50100` | Passive port range |
| `DATA_DIR` | `pandora-box` | Where events and uploads are stored |
| `BAIT_DIR` | `black-box/ftp` | Read only directory shown to clients |
| `FTP_GREETING` | `Welcome to VOFTP a very open FTP Server.` | Banner |
| `MAX_FILE_MB` | `10` | Max size of one upload |
| `MAX_TOTAL_MB` | `1024` | Max size of all uploads together |
| `MAX_CONNECTIONS` | `100` | Max simultaneous connections |
| `MAX_CONNECTIONS_PER_IP` | `5` | Max simultaneous connections per IP |
| `IDLE_TIMEOUT_MS` | `60000` | Idle connections are closed after this delay |
| `IGNORE_IPS` | none (`127.0.0.1` in Docker) | Comma separated IPs that are served but not logged (your own IP, monitoring) |
| `HONEYTOKENS` | the passwords of the default bait | Comma separated passwords that flag a login as `honeytoken: true` |

## What you get

```
pandora-box/
  events/2026-10-09.jsonl
  uploads/2026-10-09/203.0.113.7/3fa2c1d9e8b0-shell.php
```

One JSON object per line:

```json
{"ts":"2026-10-09T08:12:01.120Z","type":"login","session":"…","ip":"203.0.113.7","username":"admin","password":"admin123"}
{"ts":"2026-10-09T08:12:01.410Z","type":"upload","session":"…","ip":"203.0.113.7","clientPath":"/shell.php","file":"2026-10-09/203.0.113.7/3fa2c1d9e8b0-shell.php","size":2048,"sha256":"3fa2c1d9e8b0…"}
```

Event types: `connect`, `connection_refused`, `login`, `command`, `download`, `upload`, `upload_rejected`, `disconnect`, `client_error`, `server_error`.

## 🎣 Bait and honeytokens

The directory clients see is [black-box/ftp](black-box/ftp): a `README.txt`, a `wp-config.php.bak` and `backup/db_backup_2019.sql`, with fake credentials inside. Downloads are allowed there, and only there, and each one is logged as a `download` event.

The passwords in those files are listed in `HONEYTOKENS`. They exist nowhere else, so a login using one of them is flagged `honeytoken: true`: that bot downloaded the bait, parsed it, and came back to try what it found.

Use your own bait with `BAIT_DIR`, and list its passwords in `HONEYTOKENS`.

The sha256 is ready to be looked up on VirusTotal or MalwareBazaar.

## Allowed commands

`USER PASS SYST FEAT OPTS NOOP QUIT PWD CWD CDUP TYPE MODE STRU PASV EPSV LIST NLST SIZE RETR STOR`

`RETR` only works on the bait files. Everything else is refused, including `DELE`, `RNFR`, `MKD`, and `PORT` / `EPRT` (active mode would let anyone make the honeypot connect to any address, the classic FTP bounce attack).

## ⚠️ Safety

Uploaded files are real malware. They are stored as plain files and never executed, but do not open them on your machine, and keep the data directory away from anything that could serve or run them.

## License

MIT
