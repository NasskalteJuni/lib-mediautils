const PersistedUser = require('../persistence/User.js');

class User extends PersistedUser{

    constructor(){
        super(...arguments);
    }

    static byId(id, iterable){
        return User.byAttribute("id", id, iterable);
    }

    static byName(name, iterable){
        return User.byAttribute("name", id, iterable)
    }

    static byAttribute(attr, value, iterable){
        return iterable.reduce((found, user) => user[attr] === value ? user : found, null);
    }
}

module.exports = User;