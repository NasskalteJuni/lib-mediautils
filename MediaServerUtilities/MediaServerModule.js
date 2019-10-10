const puppeteer = require('puppeteer');
const read = require('fs').readFileSync;

class MediaServerModule{

    static set debug(bool){
        MediaServerModule._debug = bool;
    }

    static get debug(){
        return !!MediaServerModule._debug;
    }

    static _getPuppet(){
        if(!MediaServerModule._browser){
            return puppeteer.launch({headless: !MediaServerModule.debug}).then(browser => {
                MediaServerModule._browser = browser;
                return browser;
            });
        }
        return Promise.resolve(MediaServerModule._browser);
    }

    constructor(id, config = {}){
        this._id = id;
        this._isInitialized = false;
        this._onInitializedCb = config["onInitialized"] ? config["onInitialized"] : () => {};
        this._fps = config["fps"] || 30;
        this._pageTemplate = config["template"] || null;
        this._customScripts = config["scripts"] || null;
        this._debug = config["debug"] || false;
    }

    async init(){
        try{
            if(this._isInitialized) throw new Error('ALREADY INITIALIZED');
            this._instance = await (await MediaServerModule._getPuppet()).newPage();
            await this._instance.addScriptTag({path: require.resolve('./ConnectionManager')});
            await this._instance.evaluate(fps => window["fps"] = fps, this._fps);
            await this._instance.addScriptTag({path: require.resolve('./VideoMixer')});
            await this._instance.addScriptTag({path: require.resolve('./AudioMixer.js')});
            await this._instance.addScriptTag({path: require.resolve('./Recorder')});
            await this._instance.addScriptTag({path: require.resolve('./SpeechDetection.js')});
            await this._instance.addScriptTag({path: require.resolve('./Transcriber.js')});
            if(this._pageTemplate) await this._instance.setContent(read(this._pageTemplate,'utf-8'));
            if(this._customScripts) this._customScripts.forEach(async path => await this._instance.addScriptTag({path}));
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

module.exports = MediaServerModule;