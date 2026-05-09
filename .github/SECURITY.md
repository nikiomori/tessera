# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Instead, use GitHub's private vulnerability reporting:

> [Report a vulnerability](https://github.com/nikiomori/tessera/security/advisories/new)

Or email **nikiomori.x@gmail.com** with `[tessera security]` in the subject.

You'll get an initial response within a few days. Once the fix is ready, we'll
publish a GitHub Security Advisory and credit the reporter (unless you prefer
otherwise).

## Scope

The threat model assumes Tessera is **self-hosted** behind whatever auth /
network controls you choose. Things in scope:

- Server-side bugs in `/api/*` that allow code execution, file read outside the
  intended sandbox, or SSRF beyond the documented `logo-from-url` behaviour.
- Auth bypass when `TESSERA_API_KEY` is configured.
- DoS through unbounded request size, batch size, or recursion.
- Vulnerabilities in pinned third-party dependencies (segno, Pillow, FastAPI).

Out of scope:

- The hosted demo at `tessera.nikiomori.com` is rate-limited best-effort; please
  don't run automated scanners against it.
- Reports that boil down to "you can pass a malicious image and it's slow" —
  Pillow decoding is bounded; if you have a concrete CPU/memory exhaustion
  vector, that *is* in scope.

## Supported versions

The project ships from `main`. Security fixes are applied to `main` and a new
release is cut. There is no LTS branch.
