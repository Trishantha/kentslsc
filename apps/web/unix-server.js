/**
 * Next.js web server on a Unix domain socket.
 *
 * Hostinger's hbuilds sandbox isolates loopback per process: a `next start`
 * child bound to 127.0.0.1 is unreachable from the unified parent
 * (ECONNREFUSED on every loopback variant), and the sandbox exposes no
 * routable interface to bind instead. Unix domain sockets are NOT isolated —
 * the API child already speaks to the parent over one — so this custom server
 * listens on a socket file and the unified parent proxies web requests to it
 * exactly like it proxies API requests.
 *
 * This runs as a plain Node child process, so it is unaffected by the lsnode
 * module/request shims that break in-process Next.js rendering (E1068).
 */

process.env.NODE_ENV = 'production';

const { createServer } = require('http');
const path = require('path');
const next = require('next');

const socketPath = process.env.WEB_SOCKET_PATH || '/tmp/kslsc-web.sock';
const dir = path.join(__dirname);
// See server-handler.js: Next 16 needs hostname/port for absolute URL
// construction at request time. Real requests arrive with the public Host and
// x-forwarded-* headers (the unified parent sets them), so these values are
// only fallbacks.
const hostname = process.env.WEB_INTERNAL_HOSTNAME || process.env.HOST || '0.0.0.0';
const port = Number(process.env.WEB_INTERNAL_PORT || process.env.PORT || 3000);
const quiet = process.env.WEB_QUIET === 'true';

const app = next({ dev: false, dir, quiet, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => handle(req, res));
    server.on('error', (error) => {
      console.error(`Web unix socket server error: ${error.message}`);
      process.exit(1);
    });
    server.listen(socketPath, () => {
      console.log(`Web (Next.js) listening on Unix socket ${socketPath}`);
    });
  })
  .catch((error) => {
    console.error(`Failed to prepare Next.js app: ${error.message}`);
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
