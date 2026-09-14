# Contributing to Kotva

Thank you for helping improve Kotva. Keep each change focused, testable, and
documented so that pull requests remain easy to review.

## Local setup

1. Install Node.js 22 and Docker Desktop.
2. Copy `.env.example` to `.env` and replace every placeholder secret.
3. Run `npm ci`.
4. Start the stack with `docker compose up --build`.

See [README.md](README.md) for application accounts and the full local setup.

## Development workflow

1. Create a branch such as `feature/short-description` from the latest `main`.
2. Keep unrelated changes out of the branch.
3. Add or update automated tests for changed behavior.
4. Run the relevant checks before opening a pull request.
5. Explain the user-facing result and verification steps in the PR description.

```bash
npm run check
npm test
npm run test:e2e
docker compose config
```

The project intentionally checks behavior and syntax without enforcing a
maximum source-line length.

## Documentation and screenshots

Update README or feature documentation whenever setup, API behavior, roles, or
analytics outputs change. Regenerate the portfolio screenshots with:

```bash
npm run screenshots:readme
```

The screenshot task starts an isolated in-memory application and never needs
production credentials or customer data.

## Security and data

- Never commit `.env`, credentials, database dumps, or TLS private keys.
- Use synthetic identities in fixtures and screenshots.
- Do not put real JMBG, passport, payment, or claim data in issues or PRs.
- Report vulnerabilities according to [SECURITY.md](SECURITY.md).
