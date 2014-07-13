#!/bin/bash
# Build the minified version. The official minified subrosa.min.js uses
# UglifyJS 2: npm install uglify-js -g
cd js
uglifyjs jquery.min.js forge.min.js engineio.min.js app-core.js app-view-uisetters.js app-view-uifuncs.js app-view.js app-call.js app-webrtc.js app-emoticons.js -c > subrosa.min.js
cd ..
