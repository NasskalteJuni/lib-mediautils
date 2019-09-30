const puppeteer = require('puppeteer');
const read = require('fs').readFileSync;

class Server{

    static _getPuppet(){
        if(!Server._browser){
            return puppeteer.launch({headless: false}).then(browser => {
                Server._browser = browser;
                return browser;
            });
        }
        return Promise.resolve(Server._browser);
    }

    constructor(id){
        this._id = id;
        this._isInitialized = false;
        this._onInitializedCb = () => {};
    }

    async init(){
        try{
            if(this._isInitialized) throw new Error('ALREADY INITIALIZED');
            this._instance = await (await Server._getPuppet()).newPage();
            await this._instance.setContent(read(require.resolve('../private.html'),'utf-8'));
            await this._instance.evaluate(title => document.title = title, this._id);
            this._isInitialized=true;
            this._onInitializedCb();
        }catch(err){
            console.error(err);
            throw new Error('FAILED INITIALIZING');
        }
    }

    set onInitialized(cb){
        this._onInitializedCb = cb;
        if(this._isInitialized) cb();
    }

    get isInitialized(){
        return this._isInitialized;
    }

    async destroy(){
        return this._instance.close();
    }

    async acceptOffer(userId, offer){
        try{
            const sdp = await this._instance.evaluate(async (userId, offer) => {
                const answer = await window.accept(userId, offer);
                return answer.sdp;
            }, userId, offer);
            return sdp ? {type: 'answer', sdp} : null;
        }catch(err){
            console.error(err);
        }
    }

    async acceptAnswer(userId, answer){
        try{
            return await this._instance.evaluate(async (userId, answer) => {
                return await window.complete(userId, answer);
            }, userId, answer);
        }catch(err){
            console.error();
        }
    }

    async addIceCandidate(userId, iceCandidate){
        try{
            return await this._instance.evaluate(async (userId, candidate) => await window.addIceCandidate(userId, candidate), userId, iceCandidate)
        }catch(err){
            console.error(err);
        }
    }

    async onIceCandidate(cb){
        try{
            await this._instance.exposeFunction('onIceCandidateHandle', cb);
        }catch(err){
            console.error(err);
        }
    }

    async onOffer(cb){
        try{
            await this._instance.exposeFunction('onOfferHandle', cb);
        }catch(err){
            console.error(err);
        }
    }
}

module.exports = Server;