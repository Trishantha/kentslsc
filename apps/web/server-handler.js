/**
 * In-process Next.js request handler for the unified server.
 *
 * Hostinger's Node.js hosting terminates child processes, so instead of
 * spawning `next start` we prepare the Next.js app inside the same process
 * and hand HTTP requests directly to its request handler.
 */

const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const dir = path.join(__dirname);
const quiet = process.env.WEB_QUIET !== 'false';
// Next 16 needs hostname/port to build absolute request URLs at request time;
// without them the in-process handler 500s every request ("Internal Server
// Error") even though prepare() succeeds. The unified server exports these
// before requiring this module; fallbacks keep standalone use working.
const hostname = process.env.WEB_INTERNAL_HOSTNAME || process.env.HOST || '0.0.0.0';
const port = Number(process.env.WEB_INTERNAL_PORT || process.env.PORT || 3000);
const app = next({ dev, dir, quiet, hostname, port });
const handle = app.getRequestHandler();

let prepared = false;
let preparePromise = null;

async function init() {
  if (prepared) {
    return handle;
  }
  if (!preparePromise) {
    preparePromise = app.prepare().then(() => {
      prepared = true;
      // eslint-disable-next-line no-console
      console.log('Next.js web handler prepared in-process');
      return handle;
    });
  }
  return preparePromise;
}

module.exports = { init, handle };
