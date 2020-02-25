const Listenable = require("./Listenable.js");
module.exports = (superclass=Object) => class C extends Listenable(superclass){

    constructor() {
        super(...arguments);
        this._media = {}
    }

    /**
     * add media
     * @param {MediaStream|MediaStreamTrack} m The media to add
     * @param {string} [id=m.id] The unique id to identify the given media. Defaults to the medias id property
     * */
    addMedia(m, id){
        if(arguments.length === 1) id = m.id;
        if(m instanceof MediaStreamTrack) m = new MediaStream([m]);
        this._media[id] = m;
        this.dispatchEvent('streamadded', [m, id]);
    }

    /**
     * remove media
     * @param {MediaStream|MediaStreamTrack|string} m The media to remove. Can be the id or the media itself. If called without arguments or with '*', every media is removed
     * */
    removeMedia(m){
        if(arguments.length === 0 || m === '*') return this.mids.forEach(id => this.removeMedia(id));
        if(arguments[0] instanceof MediaStream || arguments[0] instanceof MediaStreamTrack){
            this.mids.forEach(id => {
                if(this._media[id].getTracks()[0].id === m.id) delete this._media[id];
                this.dispatchEvent('streamremoved', [m, id]);
            })
        }else{
            const stream = this._media[m];
            delete this._media[m];
            this.dispatchEvent('streamremoved', [stream, m]);
        }
    }

    /**
     * get media with the given id
     * */
    getMedia(id){
        return this._media[id];
    }

    /**
     * the ids of all media
     * @readonly
     * @return {Array} a list of media ids
     * */
    get mids(){
        return Object.keys(this._media).slice();
    }

};