-- Seed sm_consultor_mapping para tenant maisenergia (idempotente)
INSERT INTO public.sm_consultor_mapping (tenant_id, sm_name, canonical_name, consultor_id, is_ex_funcionario)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Bruno',      'Bruno Bandeira', 'c0ecc5e7-0efd-41d7-a25e-e3aff106ab67', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Renan',      'Renan',          '4138b8e1-93dd-47ae-ab29-1da96cb72d51', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Sebastiao',  'Sebastião',      '07849427-3e0f-4688-8d9d-515a03090e77', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Diego',      'Diego',          '5e1a5c68-c5b2-43da-a90e-d47a7c197fa9', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Claudia',    'Claudia',        '45c1cb06-601b-49c8-a04c-dec5ab209b0c', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Escritório', 'Escritório',     '67153740-7b73-406a-83e8-41ce8d9e456d', false),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Ricardo',    'Escritório',     '67153740-7b73-406a-83e8-41ce8d9e456d', true)
ON CONFLICT (tenant_id, sm_name) DO UPDATE
  SET canonical_name      = EXCLUDED.canonical_name,
      consultor_id        = EXCLUDED.consultor_id,
      is_ex_funcionario   = EXCLUDED.is_ex_funcionario,
      updated_at          = now();