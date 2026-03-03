-- Remove orphan cron job for non-existent google-calendar-poll function
SELECT cron.unschedule('google-calendar-poll-10min');