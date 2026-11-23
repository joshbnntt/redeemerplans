/**
 * Public settings. The Supabase anon key is meant to be public (the database's row-level
 * security decides what each user can do); the current site ships the same values.
 */
export const SUPABASE_URL = 'https://olzxikbosvhduajnlqrh.supabase.co';
export const SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9senhpa2Jvc3ZoZHVham5scXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODgyNjI0NDcsImV4cCI6MjAwMzgzODQ0N30.mkmueypBvRUEPQWIqnSk_NDAu0s8lbZ-mpTQCzBz-sg';

/** Where plan files live in the repository. */
export const PLAN_DIR = 'src/plan';

/** The church's time zone: plan days start at midnight here (North Santa Rosa County, FL). */
export const CHURCH_TIME_ZONE = 'America/Chicago';
