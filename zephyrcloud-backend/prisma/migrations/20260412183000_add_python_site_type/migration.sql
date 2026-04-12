ALTER TABLE `Site`
  MODIFY `type` ENUM('wordpress', 'node', 'php', 'static', 'python') NOT NULL;
