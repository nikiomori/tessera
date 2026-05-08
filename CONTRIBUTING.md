# Contributing

Thanks for your interest! The project is small enough that the workflow is informal — open an issue to discuss bigger changes, send a PR for fixes, and we'll iterate.

## Development setup

See the **Local development** section in [README.md](README.md).

## House rules

- **TypeScript**: ESLint + Prettier. Run `pnpm lint && pnpm typecheck` before pushing.
- **Python**: Ruff (lint + format) and mypy (strict). From `backend/`:
  ```bash
  ruff check . && ruff format . && mypy app && pytest -q
  ```
- **Tests**: every bug fix or new behaviour gets a pytest case (`backend/tests/`). Frontend tests are not yet wired up.
- **Commits**: short imperative ("Add X", "Fix Y"). No Conventional Commits requirement.
- **Scope discipline**: bug fixes don't need surrounding cleanup; one PR, one focused change.

## Making changes

1. Fork and create a branch (`git checkout -b feat/your-thing`).
2. Make changes.
3. Run the full check locally:
   ```bash
   (cd frontend && pnpm lint && pnpm typecheck && pnpm build)
   (cd backend  && ruff check . && mypy app && pytest -q)
   ```
4. Submit a PR with a brief description of *what* and *why*.

## Reporting bugs

Open a GitHub issue with:
- Steps to reproduce.
- What you expected vs. what happened.
- Environment (OS, browser, Docker / local).

For QR-specific bugs, please attach the JSON config you used (or paste it as text — it's just JSON; copy it from the **API call** panel).

## Areas where help is most welcome

- More dot / corner shape implementations.
- Multi-stop gradient editor (current UI exposes two stops; the API already accepts up to eight).
- Real pattern fill (textured backgrounds).
- An optional scan-counter redirect service.
- Translations / i18n.

## Code of conduct

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
