const app = require('./app.js');
const sockets = require('./sockets.js');
const port = process.env.PORT || process.argv.slice(2).pop() || 8080;
sockets(app.listen(port, () => console.log('server listening on http://127.0.0.1:'+port+'/')));
