const sessionParser = require('express-session');
const session = sessionParser({secret: 'My_little_Secret_Crypto_is_Magic', resave: true, saveUninitialized: false, cookie: {secure: false}});
module.exports = session;