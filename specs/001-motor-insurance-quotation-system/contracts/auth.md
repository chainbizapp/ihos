# Auth Flow Detail

**Date**: 2026-04-12

---

## Token Lifecycle

```
[Client]                        [API]                        [DB]
   │                              │                            │
   │── POST /auth/login ─────────▶│                            │
   │                              │── verify password hash ───▶│
   │                              │◀── user record ────────────│
   │                              │── generate access JWT      │
   │                              │── generate refresh UUID    │
   │                              │── store hash(refresh) ────▶│
   │◀── accessToken (body) ───────│                            │
   │◀── refreshToken (HttpOnly) ──│                            │
   │                              │                            │
   │── (60 min later) ────────────│                            │
   │── POST /auth/refresh ────────│                            │
   │   (cookie: refreshToken)     │── hash(token) lookup ─────▶│
   │                              │── validate not revoked     │
   │                              │── revoke old refresh ─────▶│
   │                              │── issue new access JWT     │
   │                              │── store new hash ─────────▶│
   │◀── new accessToken (body) ───│                            │
   │◀── new refreshToken (cookie)─│                            │
```

---

## Invite Flow

```
[Admin/Manager]                 [API]                     [New User]
   │                              │                            │
   │── POST /users/invite ────────▶│                            │
   │                              │── create user (Pending)    │
   │                              │── gen UUID token           │
   │                              │── store hash(token)        │
   │                              │── send email with link ───────────────▶ email
   │◀── 201 { id, status } ───────│                            │
   │                              │              ◀── GET /auth/accept?token=...
   │                              │◀── POST /auth/invite/accept │
   │                              │   { token, password }      │
   │                              │── verify hash(token)       │
   │                              │── check expiry (48h)       │
   │                              │── set password_hash        │
   │                              │── clear invite token       │
   │                              │── set status = Active      │
   │                              │── issue JWT pair           │
   │                              │──────────────────────────▶ │
   │                              │              ◀── logged in │
```

---

## Self-Registration Flow

```
[Prospective User]             [API]                    [Manager/Admin]
   │                              │                            │
   │── POST /auth/register ───────▶│                            │
   │   { email, fullName, pass }  │── create user              │
   │                              │   status: PendingApproval  │
   │◀── 201 { status: Pending } ──│                            │
   │                              │── notify Manager/Admin ─────────────▶ notification
   │                              │                       ◀── GET /users/registrations/pending
   │                              │                       ◀── PUT /users/registrations/{id}/approve
   │                              │── set status: Active       │
   │                              │── audit log                │
   │── POST /auth/login ──────────▶│                            │
   │◀── accessToken ──────────────│                            │
```

---

## Role Authorization Matrix

| Endpoint Group | Admin | Manager | Senior Staff | Staff |
|---|:---:|:---:|:---:|:---:|
| Auth (login, refresh, logout) | ✓ | ✓ | ✓ | ✓ |
| Invite accept | ✓ | ✓ | ✓ | ✓ |
| Users — read all | ✓ | ✓ | | |
| Users — invite/create | ✓ | ✓ | | |
| Users — change role | ✓ | | | |
| Users — deactivate | ✓ | | | |
| Registrations — approve/reject | ✓ | ✓ | | |
| Import — upload | ✓ | ✓ | ✓ | |
| Import — view batches/records | ✓ | ✓ | ✓ | |
| Import — approve/reject records | ✓ | ✓ | | |
| Import — publish batch | ✓ | ✓ | | |
| Mapping — read | ✓ | ✓ | ✓ | |
| Mapping — create/edit | ✓ | ✓ | ✓ | |
| Search | ✓ | ✓ | ✓ | ✓ |
| Quotation — generate + download | ✓ | ✓ | ✓ | ✓ |
| Quotation — view all history | ✓ | ✓ | | |
| Reports — view + export | ✓ | ✓ | | |
| System configuration | ✓ | | | |
| Audit log — view | ✓ | | | |

---

## JWT Claims

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "Manager",
  "jti": "unique-token-id",
  "iat": 1744000000,
  "exp": 1744003600
}
```

- `sub`: User ID (UUID)
- `role`: Single role claim; evaluated at Application layer per use-case
- `jti`: JWT ID for potential token blacklisting
