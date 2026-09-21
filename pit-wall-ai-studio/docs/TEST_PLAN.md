# Test Plan

Critical scenarios:
1. More than four configured teams; only selected teams in a session.
2. Two devices using same team link remain synchronized.
3. Unauthorized team cannot operate another team.
4. Double tap does not create accidental duplicate lap.
5. Two teams register nearly simultaneously without corrupting ordering/state.
6. Client disconnects: UI shows loss, lap action disabled; reconnect resyncs authoritative state.
7. Refresh/device replacement retains state.
8. Invalidate last lap; recompute lap count/last/best/fastest/classification everywhere.
9. Change equipment/personnel; counters survive refresh and remain neutral (no invented violation).
10. Issue +seconds, PIT_REQUIRED, warning, DQ manually; revoke/cancel where authorized; audit remains.
11. Close timing; team cannot add laps; provisional display shown.
12. Correct provisional state; officialize; final snapshot/winner display persists through refresh.
13. Attempt late event after officialization; official result does not silently mutate.
14. Reopen results requires deliberate privileged action and leaves audit evidence.
15. Broadcast/display failure does not affect timing or Race Control.
16. Stream/camera/voice-call failure has zero effect on app timing.

Use automated unit/integration tests for domain logic and persistence plus manual multi-tab/device tests for realtime/presence/UI. The Tuesday real-world test is a first-class milestone, not an afterthought.
