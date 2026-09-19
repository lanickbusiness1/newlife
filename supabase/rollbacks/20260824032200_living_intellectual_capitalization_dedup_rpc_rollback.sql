-- Controlled rollback for the V4-DEC-016 authoritative deduplication read surface.

begin;

drop function if exists public.genesis_capitalization_known_fingerprints(text);

commit;
