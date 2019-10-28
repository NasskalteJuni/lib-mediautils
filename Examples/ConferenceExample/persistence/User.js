const Sequelize = require('sequelize');
const sequelize = require('./orm.js');
class User extends Sequelize.Model {
    toJSON(){
        return {
            id: this.id,
            name: this.name,
            lastLogin: this.lastLogin
        }
    }
}

User.init({
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    lastLogin: {
        type: Sequelize.DATE,
    }
},{
    sequelize,
    timestamps: true,
    modelName: 'user'
});

module.exports = User;