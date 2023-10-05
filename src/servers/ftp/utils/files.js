const fs = require("fs");
const path = require("path");

const outDir = `${__dirname}//..//..//..//..//pandora-box//ftp//`;
const today = new Date().toISOString().split("T")[0];
const todayFilePath = path.join(outDir, today);

function moveToPandoraBox(file, ip) {
  const splitFilePath =
    process.platform === "win32" ? file.split("\\") : file.split("/");
  const fileName = splitFilePath[splitFilePath.length - 1];
  const uploadFilePath = path.join(todayFilePath, ip);
  if (!fs.existsSync(todayFilePath)) {
    fs.mkdirSync(todayFilePath);
  }
  if (!fs.existsSync(uploadFilePath)) {
    fs.mkdirSync(uploadFilePath);
  }
  fs.rename(file, path.join(uploadFilePath, fileName), (err) => {
    if (err) {
      throw err;
    }
  });
}

module.exports = moveToPandoraBox;
