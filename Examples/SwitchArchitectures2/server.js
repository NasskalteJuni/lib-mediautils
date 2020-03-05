const app = require('./app.js');
const sockets = require('./sockets.js');
const mediaServer = require('./mediaserver.js');
const port = process.env.PORT || process.argv.slice(2).pop() || 8080;
// start up the mcu and sfu, then the http server, then attach the web sockets
mediaServer.mcu.init()
    .then(() => mediaServer.sfu.init())
    .then(() => sockets(app.listen(port, () => console.log('server listening on http://127.0.0.1:'+port+'/'))))
    .catch(console.error);
