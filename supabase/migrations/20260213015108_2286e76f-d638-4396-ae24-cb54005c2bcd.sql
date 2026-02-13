ALTER TABLE loading_config DROP CONSTRAINT loading_config_sun_loader_style_check;

ALTER TABLE loading_config ADD CONSTRAINT loading_config_sun_loader_style_check
  CHECK (sun_loader_style = ANY (ARRAY[
    'pulse', 'spin', 'breathe', 'none',
    'spin-pulse', 'spin-stop',
    'spin360-stop', 'spin360-pulse', 'spin360-grow', 'spin360-shrink'
  ]::text[]));