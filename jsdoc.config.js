"use strict";

module.exports = {
  "plugins": ["plugins/markdown"],
  "recurseDepth": 10,
  "source": {
    "include": ["../../MediaServerUtilities/"],
    "exclude": ["../../node_modules/"],
    "includePattern": ".+\\.js(doc)?$",
    "excludePattern": "(^|\\/|\\\\)_"
  },
  "sourceType": "module",
  "tags": {
    "allowUnknownTags": true,
    "dictionaries": ["jsdoc","closure"]
  },
  "templates": {
    "cleverLinks": true,
    "monospaceLinks": true
  }
};