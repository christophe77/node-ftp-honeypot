# 📡 node-ftp-honeypot

[![Tests](https://github.com/christophe77/node-ftp-honeypot/actions/workflows/test.yml/badge.svg)](https://github.com/christophe77/node-ftp-honeypot/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/christophe77/node-ftp-honeypot)](LICENSE)

An FTP honeypot written in Node.js, on top of [ftp-srv](https://github.com/autovance/ftp-srv).

Bots scan the internet for open FTP servers, try default credentials and drop files: web shells, miners, botnet droppers. node-ftp-honeypot lets every one of them in, writes down everything they do, and keeps what they upload in quarantine.

- 🔑 **Every login works**, and every username / password tried is logged
- 📦 **Uploads are quarantined** with a sha256, never stored where other clients can see them
- 📝 **Every connection and command** goes to a daily JSON lines log
- 🛡️ **Nothing to steal or break**: no downloads, no deletes, no active mode, size and quota limits

Sibling project: [express-honeypot](https://github.com/christophe77/express-honeypot), the same idea for web RFI/LFI bots 🍯

## Quick start

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

Event types: `connect`, `connection_refused`, `login`, `command`, `upload`, `upload_rejected`, `disconnect`, `client_error`, `server_error`.

The sha256 is ready to be looked up on VirusTotal or MalwareBazaar.

## Allowed commands

`USER PASS SYST FEAT OPTS NOOP QUIT PWD CWD CDUP TYPE MODE STRU PASV EPSV LIST NLST STOR`

Everything else is refused, including `RETR`, `DELE`, `RNFR`, `MKD`, and `PORT` / `EPRT` (active mode would let anyone make the honeypot connect to any address, the classic FTP bounce attack).

## ⚠️ Safety

Uploaded files are real malware. They are stored as plain files and never executed, but do not open them on your machine, and keep the data directory away from anything that could serve or run them.

## License

MIT
