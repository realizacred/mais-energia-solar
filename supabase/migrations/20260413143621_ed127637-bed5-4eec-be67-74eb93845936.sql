-- Unschedule the redundant proposals-specific cron that causes infinite loops
-- The solarmarket-auto-sync cron already handles auto-detection and will sync proposals when needed
SELECT cron.unschedule('solarmarket-proposals-sync');