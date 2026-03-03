DELETE FROM monitor_string_metrics WHERE registry_id IN (
  SELECT id FROM monitor_string_registry WHERE plant_id = '4c846503-7037-44f5-8092-9453bffbbcc0'
);
DELETE FROM monitor_string_registry WHERE plant_id = '4c846503-7037-44f5-8092-9453bffbbcc0';