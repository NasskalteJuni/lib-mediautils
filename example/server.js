const express = require('express');
const app = express();
const config = require('./config.js');
const port = process.argv.slice(2).pop() || config.port || 8808;
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const sequelize = require('./persistence/orm.js');
const store = new SequelizeStore({
        db: sequelize,
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: config.session.duration,
});
const sessionConfig = {
    proxy: true,
    secret: config.session.secret,
    cookie: {
        sameSite: true,
        maxAge: config.session.duration
    },
    resave: false,
    saveUninitialized: false,
    store
};
app.use(require('cookie-parser')());
if (app.get('env') === 'production') {
    app.set('trust proxy', 1);
    sessionConfig.cookie.secure = true;
}
app.use(session(sessionConfig));
app.use((req, res, next) => {
    res.sendStatusMessage = function(str){
        this.statusMessage = str;
        this.send(str);
    };
    next();
});
store.sync();
app.use(express.static('public'));
app.use(require('body-parser').json());
app.use(require('helmet')());
app.use('/auth', require('./routes/auth.js'));
app.use(require('./routes/lobby.js'));

app.listen(port, () => console.log('http://127.0.0.1:'+port+'/'));