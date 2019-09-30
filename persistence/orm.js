const config = require('../config.js');
const Sequelize = require('sequelize');
let orm = null;
if(!orm){
    orm = new Sequelize(config.database.name,config.database.user, config.database.password, {dialect: 'mysql', logging: false});
}
module.exports = orm;