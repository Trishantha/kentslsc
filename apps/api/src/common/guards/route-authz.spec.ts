import 'reflect-metadata';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guard-rail for deny-by-default authorization.
 *
 * Authentication is enforced by the global JwtAuthGuard in AppModule, so a route
 * is public only if it carries @Public(). Making the default "protected" is
 * necessary but not sufficient: the failure mode simply inverts, from
 * "forgot @UseGuards, endpoint is wide open" to "added @Public() to silence a
 * 401, endpoint is wide open".
 *
 * This test pins the complete set of public routes. Adding one is fine — but it
 * has to be done here, in the same change, where a reviewer will see it.
 */

const SRC = join(__dirname, '..', '..');

/**
 * Every route reachable without a session. Each entry is
 * `<controller file>::<handler>`. Think before adding to this list.
 */
const PUBLIC_ALLOWLIST = new Set([
  // Liveness
  'app.controller.ts::health',

  // Stripe webhooks. Authenticated by signature inside the handler, not by a
  // session -- Stripe has no cookie to send.
  'directory/directory.controller.ts::webhook',
  'events/events.controller.ts::webhook',
  'events/events.controller.ts::recordExternalTicketClick',
  'fundraising/fundraising.controller.ts::webhook',
  'memberships/memberships.controller.ts::webhook',
  'payments/stripe-webhook.controller.ts::handleWebhook',
  'payments/stripe-webhook.controller.ts::confirmSession',

  // Anonymous auth surface
  'auth/auth.controller.ts::features',
  'auth/auth.controller.ts::forgotPassword',
  'auth/auth.controller.ts::login',
  'auth/auth.controller.ts::me',
  'auth/auth.controller.ts::refresh',
  'auth/auth.controller.ts::register',
  'auth/auth.controller.ts::resetPassword',
  'auth/auth.controller.ts::session',
  'auth/auth.controller.ts::verifyEmail',

  // Anonymous, rate-limited helpers used by the public site
  'ai/ai.controller.ts::recommend',
  'ai/ai.controller.ts::search',
  'contact/contact.controller.ts::create',

  // Public website content
  'blog/blog.controller.ts::findOne',
  'blog/blog.controller.ts::list',
  'committee/committee.controller.ts::list',
  'directory/directory.controller.ts::getBusiness',
  'directory/directory.controller.ts::listBusinesses',
  'directory/directory.controller.ts::listJobs',
  'events/events.controller.ts::findOne',
  'events/events.controller.ts::list',
  'forum/forum.controller.ts::getCategories',
  'forum/forum.controller.ts::getCategory',
  'forum/forum.controller.ts::getPostsByTopic',
  'forum/forum.controller.ts::getRecentTopics',
  'forum/forum.controller.ts::getRelatedTopics',
  'forum/forum.controller.ts::getTopic',
  'forum/forum.controller.ts::getTopicsByCategory',
  'fundraising/fundraising.controller.ts::donate',
  'fundraising/fundraising.controller.ts::getDonations',
  'fundraising/fundraising.controller.ts::getUpdates',
  'fundraising/fundraising.controller.ts::findOne',
  'fundraising/fundraising.controller.ts::list',
  'hero-config/hero-config.controller.ts::get',
  'gallery/gallery.controller.ts::list',
  'gallery/gallery.controller.ts::findOne',
  'memberships/memberships.controller.ts::getFeatures',
  'memberships/memberships.controller.ts::getTypes',
  'memberships/memberships.controller.ts::verify',
  'pages/pages.controller.ts::getBySlug',
  'pages/pages.controller.ts::getHomePage',
  'pages/pages.controller.ts::listPublished',
  'policy-documents/policy-documents.controller.ts::listPublished',
  'policy-documents/policy-documents.controller.ts::getByType',
  'gdpr-settings/gdpr-settings.controller.ts::get',
  'site-settings/site-settings.controller.ts::get',
  'payments/payments.controller.ts::getStripeConfig',
  'payments/payments.controller.ts::getPublicSettings',
  'payments/payments.controller.ts::getCheckoutSession',
]);

function findControllers(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findControllers(full, found);
    } else if (entry.endsWith('.controller.ts')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Read decorators from source rather than runtime metadata: importing every
 * controller would pull in the whole DI graph (Prisma, Redis, Stripe) just to
 * read an annotation.
 */
function publicHandlersIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const handlers: string[] = [];

  lines.forEach((line, index) => {
    if (!/^\s*@Public\(\)\s*$/.test(line)) return;

    // Walk forward past the remaining decorators to the method signature.
    for (let i = index + 1; i < lines.length; i += 1) {
      const candidate = lines[i]!;
      if (/^\s*@/.test(candidate) || candidate.trim() === '') continue;
      const match = candidate.match(/^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (match) handlers.push(match[1]!);
      break;
    }
  });

  return handlers;
}

function optionalAuthHandlersIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const handlers: string[] = [];

  lines.forEach((line, index) => {
    if (!/^\s*@OptionalAuthRoute\(\)\s*$/.test(line)) return;

    // Walk backward to find the HTTP method decorator so we can identify the handler.
    let handler: string | undefined;
    for (let i = index + 1; i < lines.length; i += 1) {
      const candidate = lines[i]!;
      if (/^\s*@/.test(candidate) || candidate.trim() === '') continue;
      const match = candidate.match(/^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (match) {
        handler = match[1]!;
      }
      break;
    }

    // Walk backward to make sure the same handler is also marked @Public().
    if (handler) {
      let isPublic = false;
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = lines[i]!;
        if (/^\s*@Public\(\)\s*$/.test(candidate)) {
          isPublic = true;
          break;
        }
        if (/^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(/.test(candidate)) {
          // Reached the previous method; stop.
          break;
        }
      }
      if (isPublic) {
        handlers.push(handler);
      }
    }
  });

  return handlers;
}

describe('route authorization', () => {
  const controllers = findControllers(SRC);

  it('finds the controllers', () => {
    expect(controllers.length).toBeGreaterThan(10);
  });

  it('only exposes routes that are on the public allowlist', () => {
    const unexpected: string[] = [];

    for (const file of controllers) {
      const rel = file.slice(SRC.length + 1);
      for (const handler of publicHandlersIn(file)) {
        const key = `${rel}::${handler}`;
        if (!PUBLIC_ALLOWLIST.has(key)) unexpected.push(key);
      }
    }

    expect(unexpected).toEqual([]);
  });

  it('has no stale allowlist entries', () => {
    const actual = new Set<string>();
    for (const file of controllers) {
      const rel = file.slice(SRC.length + 1);
      for (const handler of publicHandlersIn(file)) actual.add(`${rel}::${handler}`);
    }

    // A stale entry is not itself a vulnerability, but it hides the fact that
    // the allowlist no longer describes reality.
    const stale = [...PUBLIC_ALLOWLIST].filter((entry) => !actual.has(entry));
    expect(stale).toEqual([]);
  });

  it('does not reintroduce per-route guards that the global guards already apply', () => {
    const offenders = controllers.filter((file) =>
      /@UseGuards\(\s*(?:JwtAuthGuard|RolesGuard|FeatureGuard)/.test(readFileSync(file, 'utf8'))
    );

    // Re-applying JwtAuthGuard runs passport twice, which means two
    // `user.findUnique` calls per request on the hottest path.
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('only marks optional-auth routes that are also public and on the allowlist', () => {
    const notPublic: string[] = [];
    const notAllowed: string[] = [];

    for (const file of controllers) {
      const rel = file.slice(SRC.length + 1);
      const publicHandlers = new Set(publicHandlersIn(file));
      for (const handler of optionalAuthHandlersIn(file)) {
        const key = `${rel}::${handler}`;
        if (!publicHandlers.has(handler)) {
          notPublic.push(key);
        } else if (!PUBLIC_ALLOWLIST.has(key)) {
          notAllowed.push(key);
        }
      }
    }

    expect(notPublic).toEqual([]);
    expect(notAllowed).toEqual([]);
  });
});
