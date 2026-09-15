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
// Use the values verbatim: mapping 127.0.0.1 to 'localhost' breaks hosts
// where localhost resolves to ::1 but the listener is IPv4-only (Next 16's
// proxy phase then gets ECONNREFUSED and every dynamic page 500s).
const resolvedHostname = process.env.WEB_INTERNAL_HOSTNAME || process.env.HOST || '0.0.0.0';
const hostname = resolvedHostname;
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

      console.log('Next.js web handler prepared in-process');
      return handle;
    });
  }
  return preparePromise;
}

module.exports = { init, handle };
