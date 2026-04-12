ALTER TABLE `tenant`
  ADD COLUMN `max_sites` INTEGER NULL,
  ADD COLUMN `max_cpu_per_site` DOUBLE NULL,
  ADD COLUMN `max_memory_mb_per_site` INTEGER NULL,
  ADD COLUMN `max_team_members_per_site` INTEGER NULL;
