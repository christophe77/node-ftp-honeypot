const dns = require("dns/promises");
const net = require("net");
const { networkInterfaces } = require("os");
const { Netmask } = require("netmask");
const { normalizeIp } = require("../utils/sanitize");

function localIPv4s() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => ({ address: iface.address, cidr: iface.cidr }));
}

// Decides which IP we announce in the PASV reply.
// It used to answer 127.0.0.1 to everyone outside the LAN, which sent a good
// part of the internet's bots knocking on their own localhost.
function createPasvResolver({ publicAddress } = {}) {
  let resolvedPublic = null;

  async function getPublicAddress() {
    if (!publicAddress) return null;
    if (resolvedPublic) return resolvedPublic;
    // PASV only speaks dotted IPv4, so a hostname has to be resolved.
    resolvedPublic = net.isIPv4(publicAddress)
      ? publicAddress
      : (await dns.lookup(publicAddress, { family: 4 })).address;
    return resolvedPublic;
  }

  return async function resolvePasvAddress(clientIp) {
    const ip = normalizeIp(clientIp);
    const interfaces = localIPv4s();

    if (ip === "127.0.0.1") return "127.0.0.1";
    // Clients on the same network get our LAN address.
    const lan = interfaces.find(
      (iface) =>
        iface.cidr && net.isIPv4(ip) && new Netmask(iface.cidr).contains(ip)
    );
    if (lan) return lan.address;

    const configured = await getPublicAddress();
    if (configured) return configured;
    // Best effort: our first real interface, still better than localhost.
    return interfaces.length ? interfaces[0].address : "127.0.0.1";
  };
}

module.exports = { createPasvResolver };
