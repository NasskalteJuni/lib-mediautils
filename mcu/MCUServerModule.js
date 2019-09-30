const puppeteer = require('puppeteer');
const read = require('fs').readFileSync;

class MCUServerModule{

    static _getPuppet(){
        if(!MCUServerModule._browser){
            return puppeteer.launch({headless: false}).then(browser => {
                MCUServerModule._browser = browser;
                return browser;
            });
        }
        return Promise.resolve(MCUServerModule._browser);
    }

    constructor(id, config = {}){
        this._id = id;
        this._isInitialized = false;
        this._onInitializedCb = config["onInitialized"] ? config["onInitialized"] : () => {};
        this._fps = config["fps"] || 30;
    }

    async init(){
        try{
            if(this._isInitialized) throw new Error('ALREADY INITIALIZED');
            this._instance = await (await MCUServerModule._getPuppet()).newPage();
            await this._instance.addScriptTag({path: require.resolve('./MCUConnectionManager')});
            await this._instance.evaluate(fps => window["fps"] = fps, this._fps);
            await this._instance.addScriptTag({path: require.resolve('./MCUVideoMixer.js')});
            await this._instance.setContent(read(require.resolve('./template.html'),'utf-8'));
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
            return JSON.parse(await this._instance.evaluate(async (userId, offer) => {
                const answer = await window.connections.handleOffer(userId, offer);
                return JSON.stringify(answer);
            }, userId, offer));
        }catch(err){
            console.error(err);
        }
    }

    async acceptAnswer(userId, answer){
        try{
            return await this._instance.evaluate(async (userId, answer) => {
                return await window.connections.handleAnswer(userId, answer);
            }, userId, answer);
        }catch(err){
            console.error();
        }
    }

    async addIceCandidate(userId, iceCandidate){
        try{
            return await this._instance.evaluate(async (userId, candidate) => await window.connections.addIceCandidate(userId, candidate), userId, iceCandidate)
        }catch(err){
            console.error(err);
        }
    }

    async onIceCandidate(cb){
        try{
            return await this._instance.exposeFunction('onIceCandidateHandle', cb);
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

module.exports = MCUServerModule;