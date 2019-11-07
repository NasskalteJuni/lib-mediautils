const router = require('express').Router();
const User = require('../persistence/User.js');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
    const name = req.body.name;
    const password = req.body.password;
    if(!name) return res.status(422).sendStatusMessage('MISSING NAME');
    if(!password) return res.status(422).sendStatusMessage('MISSING PASSWORD');
    if(password.length < 5 || password.replace(/\s/g,'').length === 0) return res.status(422).sendStatusMessage('INSUFFICIENT PASSWORD');
    await User.sync();
    if(await User.findOne({where:{name}})) return res.status(422).sendStatusMessage('NAME ALREADY TAKEN');
    const created = await User.create({name, password: await bcrypt.hash(password, 10)});
    res.status(200).send(created);
});

router.post('/login',async (req, res) => {
    const name = req.body.name;
    const password = req.body.password;
    if(!name || typeof name !== 'string') return res.status(422).sendStatusMessage('MISSING NAME');
    if(!password || typeof password !== 'string') return res.status(422).sendStatusMessage('MISSING PASSWORD');
    await User.sync();
    const user = await User.findOne({where:{name}});
    if(!user) return res.status(403).sendStatusMessage('LOGIN FAILED');
    if(!await bcrypt.compare(password, user.password)) return res.status(403).sendStatusMessage('LOGIN FAILED');
    user.lastLogin = new Date();
    user.save();
    req.session.user = user;
    req.session.save(err => {
        if(err){
            console.error(err);
            return req.status(500).sendStatusMessage('COULD NOT CREATE SESSION');
        }
    });
    res.status(204).send();
});

router.post('/logout', (req, res) => {
    if(req.session && req.session.user){
        req.session.user.lastLogin = new Date();
        req.session.user.save();
        req.session.close();
        req.session = null;
    }else{
        return res.status(403).sendStatusMessage('NOT AUTHENTICATED');
    }
});

router.post('/unregister',async (req, res) => {
    if(!req.session || !req.session.user) return res.status(403).sendStatusMessage('NOT AUTHENTICATED');
    if(!await bcrypt.compare(req.body.password, req.session.user.password)) return res.status(403).sendStatusMessage('WRONG PASSWORD');
    req.session.user.remove();
});

module.exports = router;