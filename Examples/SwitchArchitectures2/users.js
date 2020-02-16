let users = [];

const exists = name => {
    return users.filter(u => u === name).length > 0;
};

const add = name => {
    if(!name) throw new Error('no name given');
    if(exists(name)) throw new Error('name exists');
    if(!/^[a-z]{2,20}$/g.test(name)) throw new Error('invalid name');
    if(name === 'server') throw new Error('invalid name');
    users.push(name);
};

const remove = name => {
    if(!exists(name)) throw new Error('no such user');
    users = users.filter(u => name !== u);
};

const all = () => {
    return users.slice();
};

module.exports = {add, remove, exists, all};