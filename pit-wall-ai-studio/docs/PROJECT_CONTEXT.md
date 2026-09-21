# Project Context

## Event
School-built karts race on a school-court track. The event is inspired by F1 presentation and Pit Wall operations. This is the first edition; if successful it may become annual.

Current physical information:
- 4 physical karts for now.
- There appear to be more teams than karts, so multiple rounds/sessions are expected.
- Do not limit team count in software.
- Current simple domain assumption: one team has one optional configurable kart name/identity. Do not build complex kart allocation unless later requirements demand it.
- Main race has been described as 30 laps.
- Qualifying has been described as 2 laps, but the exact scoring meaning of "queda la última" remains unresolved.
- Drivers/participants and human "motors" physically propel the karts; a safety kart is an exception.
- Notes mention 3 pilots (two men, one woman) and personnel changes involving 4 people every 5 laps, but exact roster/rotation semantics remain unresolved.
- At least one mandatory pit stop is expected; teams choose strategy for when to stop.
- Footwear represents tyre strategy: Hard = boots, Soft = smooth-soled sneakers, Medium = grippy-soled sneakers. At least one footwear change and at least 5 Hard laps were mentioned; exact enforcement/consecutiveness is unresolved.
- Physical flags will be used.
- Penalties can include seconds, a directive to pit next lap, and immediate DQ for some violations. Full rulebook is pending.
- Examples mentioned include Pit Wall people entering track, water-bottle limits, and failure to change shoes. The application must NOT infer mappings from these examples until confirmed.
- Safety equipment and decoration requirements are physically inspected; app may record steward decisions but does not detect them.

## User/operator reality
The project creator will set up the room/event but expects to spend much of the race focused on the stream. Normal race operation must NOT depend on the technical creator continuously operating Race Control. A teacher/race director should be able to handle sporting controls. Technical admin and Race Director concepts should remain separable.

## External systems
- Driver <-> Pit Wall open voice call: external.
- 360 helmet cameras / track cameras: external.
- OBS / streaming / multistream: external.
- QR Live: external QR giving access to the stream; OUT OF APP.
- Physical flags: authoritative physical procedure; app may mirror race status if useful.
- `/broadcast`: app-provided read-only graphics source for OBS.
