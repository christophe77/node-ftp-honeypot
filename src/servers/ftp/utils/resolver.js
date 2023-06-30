const { Netmask } = require("netmask");
const { networkInterfaces } = require("os");

const nets = networkInterfaces();
function getNetworks() {
  const networks = {};
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        networks[`${net.address}/24`] = net.address;
      }
    }
  }
  return networks;
}

const resolverFunction = (address) => {
  const networks = getNetworks();
  for (const network in networks) {
    if (new Netmask(network).contains(address)) {
      return networks[network];
    }
  }
  return "127.0.0.1";
};

module.exports = resolverFunction;
