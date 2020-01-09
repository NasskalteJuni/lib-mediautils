const _signalled = [];
const signaller = ({peer, self}) => {
    const sig = {
        peer,
        self,
        _listeners: [],
        send: function socketSendStub(msg) {
            msg = JSON.parse(msg);
            msg.sender = self;
            msg.transmitted = new Date().toISOString();
            const i = _signalled.findIndex(s => (msg.receiver === s.self) || (msg.receiver === '*' && s.self !== msg.sender));
            if(i === -1) return console.warn('unable to send', msg);
            msg = JSON.stringify(msg);
            // wait 1 ms or anything just to get into the next js env event loop
            const networkMockDelay = setTimeout(() => {
                _signalled[i]._listeners.forEach(cb => cb({data: msg}));
                clearTimeout(networkMockDelay);
            }, 1);
        },
        addEventListener: function socketOnMessageStub(type, cb) {
            if (type.toLowerCase() !== 'message') return console.error('mock not implementing anything except message');
            this._listeners.push(cb);
        }
    };
    _signalled.push(sig);
    return sig;
};