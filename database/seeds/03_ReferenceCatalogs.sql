/* GymFlow v1.0 - Reference data notes.
   Business statuses are intentionally enforced with CHECK constraints rather than status lookup tables.
   This keeps the model compact and prevents unnecessary joins for stable finite state sets.
*/
USE [GymFlowDb];
GO
PRINT 'Reference statuses are defined by CHECK constraints. Organization-specific catalogs are seeded by security.usp_SeedOrganizationDefaults.';
GO
