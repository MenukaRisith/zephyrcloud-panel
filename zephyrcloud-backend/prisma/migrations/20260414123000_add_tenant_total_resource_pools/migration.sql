ALTER TABLE `tenant`
  ADD COLUMN `max_cpu_total` DOUBLE NULL,
  ADD COLUMN `max_memory_mb_total` INTEGER NULL;

UPDATE `tenant`
SET `max_cpu_total` = `max_cpu_per_site`
WHERE `max_cpu_total` IS NULL
  AND `max_cpu_per_site` IS NOT NULL;

UPDATE `tenant`
SET `max_memory_mb_total` = `max_memory_mb_per_site`
WHERE `max_memory_mb_total` IS NULL
  AND `max_memory_mb_per_site` IS NOT NULL;
