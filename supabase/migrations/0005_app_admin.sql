-- App admin flag: gates synthetic-data shortcuts ("Seed demo students",
-- "Simulate demo ratings") so only the platform owner sees them on real
-- event pages. is_app_admin already exists in 0001_schema; this migration
-- just promotes the project owner.

update public.profiles set is_app_admin = true
  where email ilike 'helswify@uw.edu';
