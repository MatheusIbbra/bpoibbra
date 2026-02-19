-- Move extensions from public schema to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION unaccent SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;