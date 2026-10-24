# Security checklist

This repository is a local development starter. Before production:

- Add authentication and enforce ownership/tenant authorization for every dataset and analysis.
- Keep source connections server-managed. Never allow arbitrary connection strings or arbitrary host access.
- Use database-native read-only roles and schema/table grants.
- For PostgreSQL, set read-only transactions and statement timeout, and validate allowed schemas/tables.
- Use TLS and a secret manager for connection credentials.
- Apply request rate limits, upload quotas, CSV parser limits, malware scanning where appropriate, and cleanup policies.
- Escape CSV formula-leading cells when exporting to spreadsheet-compatible formats.
- Treat all source rows, names, and comments as untrusted prompt content.
- Do not log prompts containing sensitive data, credentials, or raw result rows.
- Validate SQL AST and enforce independent database permissions; parser validation is not sufficient by itself.
- Add adversarial tests for recursive CTEs, dangerous functions, extension calls, timeouts, huge joins, and resource exhaustion.
- Restrict CORS and methods for the deployment environment.
