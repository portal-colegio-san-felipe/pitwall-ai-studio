# Domain Model

Use stable IDs; display names are editable labels.

Core concepts:
- Event: annual-edition-level container (e.g. current school race edition).
- Team: event-level escudería. No hardcoded maximum of 4. Contains optional kart name/identity for current simple model.
- Participant: configurable person/role metadata as requirements mature.
- Session: one timed competitive/qualifying/race round with selected participating teams and configurable target/settings.
- TeamAccess: secret token/link granting team-operator permissions; may have multiple simultaneous client sessions.
- ClientSession/Presence: connected device/session, role, last seen, status.
- RaceEvent: append-oriented/auditable fact or action with server timestamp, actor, session/team references, payload, validity/correction metadata.
- Lap: derived/recorded timing fact originating from accepted lap event(s), never trusted solely from client clock.
- PitEvent: neutral PIT_IN/PIT_OUT facts when implemented.
- EquipmentEvent: neutral equipment/compound change fact; equipment labels/config may include HARD/MEDIUM/SOFT for this event.
- PersonnelEvent: neutral change of active people/roles.
- Penalty: steward-issued time penalty/warning/note with reason and audit fields.
- Directive: steward-issued obligation such as PIT_REQUIRED with PENDING/SERVED/CANCELLED lifecycle.
- TeamSessionStatus: competitive state such as ACTIVE/FINISHED/RETIRED/DISQUALIFIED, separate from transient pit/connection state.
- FinalResultSnapshot: official frozen classification/statistics plus declared_at/declared_by and supporting references.

Do not over-generalize unresolved rules into an elaborate rules engine before the rulebook exists.
