const FtpSrv = require("ftp-srv");
const resolverFunction = require("./utils/resolver");
const moveToPandoraBox = require("./utils/files");

function startFtpServer() {
  const port = 21;
  const ftpServer = new FtpSrv({
    url: `ftp://0.0.0.0:${port}`,
    pasv_url: resolverFunction,
    greeting: "Welcome to VOFTP a very open FTP Server.",
    file_format: "ls",
    whitelist: ["USER", "PASS", "PWD", "TYPE", "PASV", "LIST", "STOR"],
  });

  ftpServer.on(
    "login",
    ({ connection, username, password }, resolve, reject) => {
      connection.on("STOR", (error, fileName) => {
        moveToPandoraBox(fileName, connection.log.fields.ip);
      });
      if (username !== "" && password !== "") {
        return resolve({ root: `${__dirname}//..//..//..//black-box//ftp//` });
      }
      return reject(new Error("Invalid username or password", 401));
    }
  );

  ftpServer.listen().then(() => {
    console.log("Ftp server is starting...");
  });
}

module.exports = startFtpServer;
