const Listenable = require("../../../MediaServerUtilities/Listenable.js");
const architectures = Object.freeze(['mesh', 'sfu', 'mcu']);
const floormod = (n, m) => ((n % m) + m) % m;


class Architecture extends Listenable(){

    constructor(initial = 'mesh') {
        super();
        this._architecture = initial;
    }

    next(){
        const previous = this._architecture;
        this._architecture = floormod(architectures.indexOf(architecture) + 1, architectures.length);
        this.dispatchEvent("architecture:next", [this._architecture, previous]);
        this.dispatchEvent("architecture:switch", [this._architecture, previous]);
    }

    prev(){
        const previous = this._architecture;
        this._architecture = floormod(architectures.indexOf(architecture) - 1, architectures.length);
        this.dispatchEvent("architecture:prev", [this._architecture, previous]);
        this.dispatchEvent("architecture:switch", [this._architecture, previous]);
    }

    set value(architecture){
        architecture = architecture.toLowerCase();
        if(architectures.indexOf(architecture) === -1) throw new Error("INVALID ARCHITECTURE");
        const previous = this._architecture;
        this._architecture = architecture;
        this.dispatchEvent("architecture:switch", [this._architecture, previous]);
    }

    get value(){
        return this._architecture;
    }
}

module.exports = Architecture;