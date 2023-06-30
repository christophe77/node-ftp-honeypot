const fs = require('fs')
const path = require('path');

const outDir = `${__dirname}//..//..//..//..//pandora-box//ftp`
const today = new Date().toISOString().split('T')[0]
const todayFilePath = path.join(outDir, today)

function moveToPandoraBox(file, ip) {
console.log(todayFilePath)
    if (!fs.existsSync(todayFilePath)) {
        fs.mkdirSync(todayFilePath);
    }
}

module.exports = moveToPandoraBox