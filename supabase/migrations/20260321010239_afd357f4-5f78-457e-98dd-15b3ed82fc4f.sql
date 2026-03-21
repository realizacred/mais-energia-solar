-- Extend monitoring-sync cron window from 8-22 UTC to 6-23 UTC
-- This covers 3h-20h BRT (captures early morning and late evening sync)

SELECT cron.alter_job(28, schedule := '0,15,30,45 6-23 * * *');  -- deye
SELECT cron.alter_job(29, schedule := '2,17,32,47 6-23 * * *');  -- solis
SELECT cron.alter_job(30, schedule := '4,19,34,49 6-23 * * *');  -- growatt
SELECT cron.alter_job(31, schedule := '6,21,36,51 6-23 * * *');  -- huawei
SELECT cron.alter_job(32, schedule := '8,23,38,53 6-23 * * *');  -- solaredge