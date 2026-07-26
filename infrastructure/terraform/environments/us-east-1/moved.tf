# Preserve existing RDS module state after adding count for parallel Aurora migration.
moved {
  from = module.rds
  to   = module.rds[0]
}
