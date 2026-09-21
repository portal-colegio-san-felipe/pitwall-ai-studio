# Platform Architecture — Google AI Studio Build

Use Google AI Studio Build as the implementation environment and lean into its supported full-stack path rather than fighting the platform.

## Preferred platform shape
- Web application using the AI Studio full-stack environment.
- React frontend unless there is a concrete reason to choose another supported frontend approach.
- Node.js server runtime for authoritative server operations.
- Firebase Firestore for durable application data when available/provisionable in the project.
- Realtime behavior may use the simplest reliable AI Studio/Firebase/server mechanism that satisfies the shared contracts. Do not introduce extra infrastructure without need.
- Keep secrets server-side.
- Keep the repository syncable with GitHub; source code must remain portable and understandable outside AI Studio.

## Critical authority boundary
Do NOT implement authoritative race mutations as unrestricted direct browser writes to Firestore. A client may subscribe/read through appropriate mechanisms, but lap registration, privileged corrections, stewarding, officialization, permission checks, deduplication and authoritative timestamps must pass through trusted server-side validation.

Firestore offline behavior must never cause a timing-critical action to be queued and accepted later with misleading timing. If authoritative connectivity is unavailable, disable the relevant action and resync before re-enabling it.

## Data design
Firestore is document-oriented. Design collections/documents around clear event/session/team boundaries and durable audit facts without forcing a relational schema into documents. Avoid giant ever-growing single documents and avoid fragile state stored only in process memory. Derived projections may be cached, but authoritative/audit facts must remain recoverable.

## Testing expectations
Use the Node/TypeScript/JavaScript testing tools that fit the generated stack. Automated tests must cover domain logic and server authorization/validation. Use isolated test fixtures, not production seed data. In addition, manually verify multi-tab realtime/presence/reconnect behavior in the AI Studio environment and on real devices before event day.

## Agent behavior
AI Studio's agent may choose implementation details inside these boundaries. Do not replace required server authority with client-only convenience. Do not add Gemini/LLM functionality to the product merely because the platform provides it; this application does not require generative AI at runtime.
