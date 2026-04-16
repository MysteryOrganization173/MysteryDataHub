// Thin bootstrap so production/local always run the same server implementation.
// Keeping this file avoids Render services that still run `node server.js` from drifting.
import './src/server.js';
