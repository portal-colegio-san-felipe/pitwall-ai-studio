# Concrete Acceptance Scenarios

These scenarios supplement `TEST_PLAN.md`. They describe observable behavior, not required implementation details. Automated tests may use isolated temporary fixtures. Never seed these examples into production.

## A — Multiple teams and sessions
Given an empty event, create at least 6 temporary test teams and two temporary test sessions. Assign only a subset of teams to one session. After reload, team/session membership must be unchanged. There must be no software maximum of four teams.

## B — Same team, two devices
Open the same temporary team access link in two independent clients. Both must show the same authoritative team state. Register an accepted lap from one client; the other client, Race Control, Display and Broadcast must update without manual refresh.

## C — Permission boundary
With Team A credentials/link, attempt to submit an operational action for Team B by manipulating a request rather than merely using the UI. The backend must reject it and persist no authoritative Team B change.

## D — Double tap
Send two lap intents from the same team close enough to represent an accidental double tap. The protection strategy must prevent an accidental duplicate from becoming two legitimate laps while still allowing later legitimate laps. Document the chosen deduplication behavior.

## E — Disconnect and resync
While a team client is connected, interrupt authoritative connectivity. The UI must visibly leave EN LÍNEA, timing-critical controls must become unavailable, and no offline lap may later appear as if it occurred on reconnect. Restore connectivity; the client must resync from authoritative state before controls are re-enabled.

## F — Correction propagation
Create several isolated test laps such that one is currently BEST and/or LAST. Invalidate/correct that event through an authorized control. Lap count, LAST, BEST, fastest-lap projection and relevant classification must recompute and update all connected views; audit history must still explain the original event and correction.

## G — Neutral measurement
Record an equipment change and a personnel change. The system may display current equipment, laps in stint, totals and laps since personnel change. It must NOT infer a violation, color it as illegal, issue a penalty, or DQ based on unresolved rulebook notes.

## H — Manual stewarding
Race Control issues a temporary +3.000 s time penalty with a reason, then a PIT_REQUIRED directive. Raw timing remains separately visible/stored. The directive can move through PENDING -> SERVED or CANCELLED. A DQ can be deliberately issued and deliberately reversed by an authorized actor, with audit history retained.

## I — Official result freeze
Close timing. Team clients must no longer be able to add accepted laps. Show provisional/review state. After authorized corrections, declare results official and persist a final snapshot. Refresh all clients: official classification remains identical. A late request must not silently mutate it. Reopen requires an explicit privileged, confirmed, audited action.

## J — External systems independence
Assume OBS, cameras, voice call and stream QR are unavailable. Timing, Race Control, team operation, persistence and Display must continue to function because none of those external systems are dependencies of race state.
