const express = require('express');
const app = express();
const path = require('path');
app.set('title','example conference');
app.set('views', require('path').join(__dirname,'public'));
app.engine('ejs', require('ejs').renderFile);
app.set('view engine','ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(require('./session.js'));
app.use(require('./auth.js'));
app.get('/', (req, res) => res.render('login', {title: app.get('title')}));
app.get('/lobby', (req, res) => req.session ? res.render('lobby', {name: req.session.user, title: app.get('title')}) : res.redirect('/'));
app.get('/bundle.min.js', (req, res) => res.sendFile(path.resolve(__dirname,'../../dist/bundle.min.js')));
app.use((err, req, res, next) => { console.error(err.stack); res.render('error', {error: err.message}); });
app.use((req, res) => res.status(404).render('404',{title: app.get('title')}));

module.exports = app;