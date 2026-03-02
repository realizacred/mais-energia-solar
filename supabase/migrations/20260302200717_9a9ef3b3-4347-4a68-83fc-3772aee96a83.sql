-- Fix existing COLLECTOR devices: reclassify as logger
UPDATE monitor_devices 
SET type = 'logger', 
    model = 'Datalogger'
WHERE (metadata->>'deviceType') = 'COLLECTOR' 
  AND type = 'inverter';