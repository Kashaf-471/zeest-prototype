# Implementation plan and assumptions

1. Persisted accounts, physician ownership, synthetic seeds and encounter routes.
2. Local PCM/WAV recording, uploaded audio, transcription jobs and editable note revisions.
3. Persisted clinical inputs, explicit scenario fixtures and immutable source snapshots.
4. Revision-safe review transactions, decisions and append-only audit.
5. Integration tests, browser checks, actual speech test and startup documentation.

SQLite is the local default. No patient creation or additional roles. New physicians have no patients. Small English CPU speech model, configurable locally. Non-overlapping WAV chunks are ordered for live recognition; final full audio reconciles chunk boundaries. Clinical fixtures are selected explicitly and never inferred from arbitrary uploaded content. Notes are manual structured fields; recognition does not infer SOAP, diagnoses or speakers.

Real: accounts, sessions, records, uploads, speech inference, saved notes, history, review and audit. Simulated: specialist findings, relevance mapping, diagnosis, treatment, evidence and critic. No vector embeddings or hosted inference.

Frontend revision authorised 21 October 2026: Dashboard replaces My Patients as the login destination. A persistent physician sidebar, review queue, global decisions, patient search, guided encounter steps, inline help, keyboard navigation and unsaved-edit protection replace the original flat screens. See FRONTEND_REDESIGN.md for design decisions and validation.
