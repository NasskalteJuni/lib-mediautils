const router = require('express').Router();
const users = require('./users.js');

router.post('/session', (req, res) => {
    try{
        const name = req.body.name;
        users.add(name);
        req.session.user = name;
        req.session.save();
        res.redirect('/lobby?user='+name);
    }catch(error){
        res.status(400).render('login', {title: router.get('title'), error});
    }
});

router.delete('/session/:user', (req, res) => {
    try{
        user.remove(req.params.user);
        req.session.close();
        res.render('login', {title: router.get('title')});
    }catch (error) {
        res.status(400).render('login', {title: router.get('title'), error});
    }
});

module.exports = router;