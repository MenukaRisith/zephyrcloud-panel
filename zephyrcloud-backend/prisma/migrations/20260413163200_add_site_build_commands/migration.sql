-- AlterTable
ALTER TABLE `Site`
  ADD COLUMN `build_command` VARCHAR(191) NULL,
  ADD COLUMN `install_command` VARCHAR(191) NULL,
  ADD COLUMN `start_command` VARCHAR(191) NULL;
