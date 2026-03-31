# Security Policy

## Reporting a vulnerability

Please do not open a public issue for suspected security vulnerabilities.

Instead, report it privately to the maintainers through a private contact channel if available. If no private channel is available yet, open a minimal issue asking for a private reporting path without including exploit details.

## Scope notes

PocketBabel is a frontend-only app. The most relevant classes of security issues are likely to be:

- unsafe handling of untrusted text input
- service worker or cache behavior that exposes unexpected data
- dependency vulnerabilities in the client build/runtime chain

## Response goals

The maintainers will try to:

1. confirm receipt
2. assess impact
3. prepare a fix or mitigation
4. disclose publicly after the issue is resolved or sufficiently mitigated
