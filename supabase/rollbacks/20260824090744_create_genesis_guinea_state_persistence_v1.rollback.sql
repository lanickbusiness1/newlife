-- Destructive rollback for V4-DEC-018 persistence.
-- Execute only under an approved rollback gate with a verified backup/export.
-- PostgreSQL DDL is transactional: this rollback has been tested inside BEGIN/ROLLBACK.

drop schema if exists genesis_guinea_state cascade;
