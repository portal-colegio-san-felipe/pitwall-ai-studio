# UI Specification

ALL front-facing text is Spanish.

## Shared visual language
Near-black/graphite background, slightly lighter panels, white/gray typography. Technical sans font; tabular/monospaced numerals for timing. Thin separators, restrained radius/shadows. Green OK/on-track, yellow caution, red critical/DQ/red flag, purple fastest lap, cyan/blue actions. Team color is an accent, not a full-screen fill.

## Team Pit Wall — mobile first
High-priority hierarchy:
- team identity / position when meaningful
- connection status
- lap count / last / best
- very large REGISTRAR VUELTA button
- current neutral strategy measurements: current equipment, stint/laps since equipment change, personnel/current crew and laps since change, pit state/history as implemented
- Race Control directives/penalties prominently
- recent history

Offline/reconnecting state must be impossible to miss; timing controls disabled when unsafe.

## Race Control — desktop first
Dense but clear:
- session/race status
- live classification/timing
- team operational measurements
- connection/presence status
- active directives/penalties
- recent event feed
- focused team stewarding panel
- correction tools
- session lifecycle controls
Dangerous actions separated/confirmed.

## Display — 16:9 read only
Low density, readable at distance. Live classification with position, team, laps, last/best as appropriate; fastest lap; race status. Safe animations for position changes/callouts only after core stable.
On timing close: Spanish provisional/review state. On officialization: short winner animation + final classification, then stable final view.

## Broadcast — 16:9 read only
Medium-density graphics intended for OBS capture. It does not ingest or manage video. Avoid dependencies on OBS for app operation.
