# Security Policy

## Supported versions

All `@urbicon-ui/*` packages are released together under a single synchronized
version. Security fixes land on the latest released version — please upgrade to
the latest release before reporting.

## Reporting a vulnerability

Please report security vulnerabilities **privately**. Do **not** open a public
issue, pull request, or discussion for a suspected vulnerability.

Email **info@urbicon.de** with:

- a description of the vulnerability and its impact,
- steps to reproduce (a minimal proof-of-concept if possible),
- the affected package(s) and version(s).

You will receive an acknowledgement within a few days. Once the report is
confirmed and a fix is prepared, we will agree a disclosure timeline with you
and credit you in the release notes (unless you prefer to stay anonymous).

## Scope

The `@urbicon-ui/auth` package handles authentication (JWT sessions,
refresh-token rotation, passkeys/WebAuthn, Web Push). Reports touching
authentication, session handling, token issuance/rotation, or the cryptographic
primitives are treated with priority.

The documentation site (`apps/docs`) is a static demo with no backend and no
real user data; findings there are lower priority unless they also affect a
shipped package.
