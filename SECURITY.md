# Security Policy

## Supported version

Security fixes are applied to the latest revision of the `main` branch. Older
portfolio branches and local demo snapshots are not supported releases.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Use
GitHub's private vulnerability reporting for this repository when available,
or contact the maintainer privately through the GitHub profile linked to the
repository.

Include the affected endpoint or component, reproducible steps, expected
impact, and any suggested mitigation. Do not include real customer data or
actively exploit the public demo. A report will be acknowledged before a fix
or disclosure timeline is agreed.

## Deployment note

The public instance is a read-only portfolio environment populated with
synthetic data. Anyone deploying Kotva must replace all example credentials,
use a strong JWT secret, restrict database ports, enable HTTPS, configure
backups, and follow the production checklist in [DEPLOYMENT.md](DEPLOYMENT.md).
