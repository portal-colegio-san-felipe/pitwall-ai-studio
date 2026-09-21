# Realtime & Persistence Requirements

The exact implementation is platform-specific. Preserve these invariants regardless of stack:
- Backend/server is authoritative for accepted timing actions and permissions.
- Multiple team clients, Race Control, Display, and Broadcast receive updates without manual refresh.
- Reload/reconnect reconstructs authoritative state from persistence, not fragile browser memory.
- Realtime delivery may be a projection mechanism; persistent facts/history remain durable.
- Avoid high-frequency polling/updates when event-driven updates suffice.
- At expected school-event scale (~dozens of clients), prioritize simplicity/reliability over distributed-system complexity.
- Do not allow direct untrusted browser writes to authoritative race state merely because the database SDK supports client writes.
- If the chosen platform provides offline database caching, do not let timing-critical writes be silently queued and later accepted with misleading timing.
