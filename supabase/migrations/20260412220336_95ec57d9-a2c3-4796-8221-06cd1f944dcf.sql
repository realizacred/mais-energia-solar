UPDATE sm_operation_runs 
SET status = 'completed', 
    finished_at = NOW(), 
    processed_items = 86, 
    total_items = 1893, 
    success_items = 86,
    error_summary = 'Partial by time budget: 1807 remaining (orphan run closed manually)'
WHERE id = '719d4af3-21fe-4b20-a97b-7c87f210f395' 
  AND status = 'running';