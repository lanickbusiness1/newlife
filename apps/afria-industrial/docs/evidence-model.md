# Evidence model — R.E.M.E-compatible proof ledger

Each material transition is evidence-addressable. The ledger stores event type, actor, scope, timestamp, input hash, previous hash, output hash, source references, decision and metadata.

Payload serialization uses canonical JSON with sorted keys and compact separators. `input_hash = SHA256(canonical_payload)`. Each output hash covers event type, actor, scope, timestamp, input hash, previous output hash and source references. The first record anchors to 64 zero characters.

`verify_chain()` recomputes hashes and links in sequence. `/health/ready` returns HTTP 503 when integrity is false. Public API exposes GET `/evidence` and no update/delete route. Regulated production may add external timestamping, signatures or immutable anchoring; v1 does not claim those controls.
