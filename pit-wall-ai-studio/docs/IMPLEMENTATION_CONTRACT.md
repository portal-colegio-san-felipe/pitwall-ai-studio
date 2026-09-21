# Implementation Contract

This specification defines outcomes and invariants, not a mandatory internal code layout unless a platform-specific instruction says otherwise.

## Agent freedom
The implementation agent MAY choose sensible internal modules, components, service boundaries, schemas, libraries, naming, and realtime transport appropriate to its platform.

The agent MUST NOT trade away these contracts for convenience:
- authoritative timing and privileged mutations are validated server-side;
- durable state survives refresh/reconnect and expected server lifecycle events;
- team permissions are enforced server-side, not only hidden in UI;
- timing-critical actions are not silently queued offline;
- corrections and stewarding actions remain auditable;
- multiple clients converge on the same authoritative state;
- official results cannot silently mutate;
- all front-facing text is Spanish;
- unresolved sporting rules are not invented.

## Prefer boring, maintainable solutions
At this event scale, choose the simplest robust implementation. Avoid unnecessary microservices, queues, distributed infrastructure, generic rules engines, or elaborate abstractions. A future student/developer should be able to understand the repository.

## No production demo state
Examples in documentation and automated test fixtures are illustrative only. Do not seed fake teams, laps, penalties, sessions, or events into the production database/application.
