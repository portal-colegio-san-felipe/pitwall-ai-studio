# Access, Roles, Presence

Roles/surfaces:
- Technical Admin: setup/configuration/recovery capabilities; not required for routine sporting operation.
- Race Director / Race Control: sporting operations, stewarding, corrections, finish/officialization.
- Team Operator: only its team's allowed operational intents.
- Display: read-only.
- Broadcast: read-only.

Team access:
- Generate unguessable team token/link.
- Token maps server-side to event/team/permissions.
- Multiple simultaneous devices per team are allowed.
- Do not identify authority merely from a readable URL slug.
- Technical admin can regenerate a team token if compromised.

Presence:
- Track connected client/session identity, role/team, connection state and last seen.
- Race Control sees team/device connectivity.
- Client UX states: EN LÍNEA, RECONECTANDO, SIN CONEXIÓN.
- Provide explicit `REINTENTAR CONEXIÓN`/resync behavior.
- A client may leave/disconnect its session.
- Race Control/authorized admin may kick a specific client session without necessarily invalidating the entire team token.
- Reconnect always resynchronizes authoritative state.

Pre-race readiness may show missing operators/display/broadcast as warnings, not necessarily hard blockers unless later configured.
