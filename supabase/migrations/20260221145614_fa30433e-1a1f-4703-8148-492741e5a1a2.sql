UPDATE aneel_sync_runs 
SET status = 'timed_out', 
    finished_at = now(), 
    error_message = 'Isolate killed — fire-and-forget pattern causava shutdown prematuro'
WHERE id = '3d134b24-5163-4d1b-9d18-ac333d837ac6' AND status = 'running';