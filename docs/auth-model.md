# Authentication and authorization model

The API is **deny-by-default**. Every HTTP route requires a valid session unless it is explicitly marked as public. The global guard chain in `apps/api/src/app.module.ts` enforces this in order:

1. `AppThrottlerGuard` — rate limiting.
2. `JwtAuthGuard` — session validation.
3. `CsrfGuard` — CSRF double-submit token on state-changing routes.
4. `EmailVerifiedGuard` — blocks unverified users from portal routes.
5. `RolesGuard` — role-based access control.
6. `PermissionGuard` — permission-based access control.
7. `FeatureGuard` — membership-feature gating.

## Public routes

A route is public only when it carries the `@Public()` decorator. Public routes are listed in the `PUBLIC_ALLOWLIST` inside `apps/api/src/common/guards/route-authz.spec.ts`. The test fails if a public route is not on the allowlist or if the allowlist contains a stale entry.

Rules for adding a public route:

1. Add `@Public()` to the handler.
2. Add the handler to `PUBLIC_ALLOWLIST` in the same change.
3. If the route needs to read an authenticated user when one is present (e.g. `/auth/me`, guest donations), also add `@OptionalAuthRoute()`.

## Optional authentication

`@OptionalAuthRoute()` tells `JwtAuthGuard` that the route is public but may still use a session if the client provides valid credentials. The guard behaves as follows:

- If the route is public and **not** marked optional-auth, authentication is skipped entirely.
- If the route is public and **is** marked optional-auth, anonymous requests are allowed, but requests that carry credentials are validated strictly. An expired or forged token is rejected.

Use the `@OptionalAuth()` parameter decorator to read the user inside the handler. Without `@OptionalAuthRoute()` on the route, `@OptionalAuth()` will always return `null`.

## Email verification gating

By default, a signed-in user must have a verified email address to access protected routes. Routes that must remain reachable before verification (e.g. resend verification, logout, session management) should carry `@AllowUnverified()`.

## CSRF protection

State-changing requests (POST, PUT, PATCH, DELETE) to protected routes must include a `csrfToken` cookie and a matching `X-CSRF-Token` header. The CSRF token is issued alongside the access/refresh token cookies during login, refresh, and session probe.

Exemptions:

- Safe methods (GET, HEAD, OPTIONS).
- Public routes, including Stripe/PayPal webhook endpoints (those use signature verification instead).

## Roles and permissions

- `@Roles(...)` restricts a route to one or more `UserRole` values.
- `@RequirePermission(...)` restricts a route to users who hold one of the listed back-office permissions. `ADMIN` bypasses permission checks.
- `@RequireFeature(...)` restricts a route to users whose active membership includes one of the listed membership features. `ADMIN` bypasses feature checks.

Do **not** re-apply `JwtAuthGuard`, `RolesGuard`, or `FeatureGuard` with `@UseGuards()` on individual controllers — the global guards already cover every route.

## Testing

Auth guard unit tests live in:

- `apps/api/src/common/guards/jwt-auth.guard.spec.ts`
- `apps/api/src/common/guards/email-verified.guard.spec.ts`
- `apps/api/src/common/guards/roles.guard.spec.ts`
- `apps/api/src/common/guards/permission.guard.spec.ts`
- `apps/api/src/csrf/csrf.guard.spec.ts`
- `apps/api/src/common/guards/route-authz.spec.ts` (public-route allowlist)

Run them with:

```bash
pnpm --filter @kentslsc/api test
```
