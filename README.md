# node-ftp-honeypot

node-ftp-honeypot is a ftp honepot.
When the application is launched, a ftp server is launched.
Everything is forbidden except file upload.
When a bot or a ftp scanner tries to upload a file this file is moved into pandora-box inside a folder named with the attacker IP.


## Installation

    yarn install
or
    npm install

## Usage

    yarn start
or
    npm start