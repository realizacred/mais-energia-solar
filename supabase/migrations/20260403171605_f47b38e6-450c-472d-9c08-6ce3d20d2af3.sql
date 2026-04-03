-- Enable Realtime on solar_market_sync_logs for live sync progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE solar_market_sync_logs;