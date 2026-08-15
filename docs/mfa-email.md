# Email MFA — Implementation Plan

> **Status:** Planned — not yet implemented.

## Overview

After a successful password check at login, the API issues a short-lived **MFA challenge** instead of full session tokens. The user is redirected to an OTP entry screen, submits the 6-digit code sent to their email, and only then receives real access + refresh tokens.

MFA is **opt-in per user** via a profile toggle but is **mandatory and non-disableable for ADMIN accounts**.

---

## 1. Database (`packages/database/prisma/schema.prisma`)

- Add `mfaEnabled Boolean @default(false) @map("mfa_enabled")` to the `User` model.
- Add a new `MfaChallenge` model:

  ```prisma
  model MfaChallenge {
    id         String    @id @default(uuid())
    userId     String    @map("user_id")
    codeHash   String    @map("code_hash")        // SHA-256 of the 6-digit code
    expiresAt  DateTime  @map("expires_at")       // now + 10 min
    consumedAt DateTime? @map("consumed_at")
    attempts   Int       @default(0)              // max 5
    createdAt  DateTime  @default(now()) @map("created_at")

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
    @@index([expiresAt])
    @@map("mfa_challenges")
  }
  ```

- Add three values to the `AuthEventType` enum:
  - `MFA_CODE_SENT`
  - `MFA_SUCCESS`
  - `MFA_FAILURE`

- Generate a new Prisma migration.

---

## 2. API — MFA service (`apps/api/src/auth/mfa.service.ts`)

New `@Injectable()` service with:

| Method | Description |
|---|---|
| `challengeRequired(user)` | Returns `true` if `user.mfaEnabled` is true **or** `user.role === ADMIN`. |
| `createChallenge(userId)` | Generates a 6-digit code via `crypto.randomInt(0, 1_000_000)` (zero-padded), stores SHA-256 hash, emails the code, returns `challengeId`. |
| `verifyChallenge(challengeId, code)` | Increments `attempts`, validates hash and expiry, marks `consumedAt`; returns `userId` on success, throws `UnauthorizedException` otherwise. Throws after 5 failed attempts. |

### Security notes
- The raw code is **never persisted** — only its SHA-256 hash.
- Maximum **5 attempts** per challenge; beyond that the challenge is dead and a fresh login is required.
- Challenge expires in **10 minutes**.
- `challengeId` is a UUID — reveals nothing about the account.

---

## 3. API — Email service (`apps/api/src/email/email.service.ts`)

Add one new method:

```ts
async sendMfaCode(email: string, name: string, code: string, expiresInMinutes: number)
```

The code is displayed in the email body in large, readable format. The subject should read: `"Your Kent SLSC sign-in code"`.

---

## 4. API — Auth service & controller

### `auth.service.ts` — `login()` change
After successful password validation and lockout clear:
- If `mfa.challengeRequired(user)` → call `mfa.createChallenge(user.id)` and return `{ mfaRequired: true, challengeId }` **without** setting any cookies or issuing tokens.
- Otherwise → existing token-issuing flow (no change).

### `auth.controller.ts` — new endpoints

**`POST /auth/mfa/verify`**
- `@Public()` with tight throttle: `{ limit: 5, ttl: 600_000, blockDuration: 900_000 }`
- Body: `{ challengeId: string, code: string }`
- Calls `mfa.verifyChallenge()`, then `authService.issueSession()`, sets cookies, records `MFA_SUCCESS` audit event.
- On failure, records `MFA_FAILURE`; after max attempts the challenge is exhausted.

**`POST /auth/mfa/resend`**
- `@Public()` with throttle: `{ limit: 3, ttl: 600_000 }`
- Body: `{ challengeId: string }` — looks up the original `userId` from the challenge and creates a new challenge.
- Replaces the old challenge (mark `consumedAt`) and returns a new `challengeId`.

**`PATCH /auth/mfa`**
- Authenticated, standard guards.
- Body: `{ enabled: boolean }`
- ADMINs: throw `ForbiddenException` (MFA is always on for admins).
- Others: update `user.mfaEnabled`.

---

## 5. Shared package (`packages/shared/src/schemas/auth.ts`)

Add and export:

```ts
export const mfaVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/)
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
```

---

## 6. Web — Login page (`apps/web/app/[locale]/auth/login/page.tsx`)

- After a login response with `mfaRequired: true`, **swap to an inline OTP panel** (no page navigation — just reveal a second form section) where the user types the 6-digit code.
- On submit, `POST /auth/mfa/verify` with `{ challengeId, code }`; on success redirect as normal.
- Show a 10-minute countdown and a "Resend code" button (calls `POST /auth/mfa/resend`, updates `challengeId` in local state).

---

## 7. Web — Dashboard / profile settings

- Add an "Two-step verification" section with an enable/disable toggle that calls `PATCH /auth/mfa`.
- For ADMIN users, show the toggle as always-on and disabled with a note explaining it is required for admin accounts.

---

## 8. Translations (`apps/web/messages/en.json`)

Add under the `"auth"` key:

```json
"mfaTitle": "Check your email",
"mfaInstructions": "We sent a 6-digit code to {email}. Enter it below to continue.",
"mfaCodeLabel": "Verification code",
"mfaVerify": "Verify",
"mfaVerifying": "Verifying…",
"mfaResend": "Resend code",
"mfaResent": "A new code has been sent.",
"mfaInvalidCode": "That code is incorrect or has expired.",
"mfaExpiredChallenge": "Your session has expired. Please sign in again.",
"mfaSettingsTitle": "Two-step verification",
"mfaSettingsDescription": "Send a one-time code to your email address each time you sign in.",
"mfaEnabled": "Enabled",
"mfaDisabled": "Disabled",
"mfaAdminRequired": "Two-step verification is always required for administrator accounts."
```

---

## Audit trail

All MFA events are appended to `auth_events` (existing table) using the three new `AuthEventType` values:

| Event | When |
|---|---|
| `MFA_CODE_SENT` | Challenge created / code emailed |
| `MFA_SUCCESS` | Code verified, session issued |
| `MFA_FAILURE` | Wrong code or expired challenge |
