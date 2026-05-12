INSERT INTO public.inversores_catalogo (fabricante, modelo, potencia_nominal_kw, tipo, fases, tenant_id, ativo, status)
VALUES
('SOLIS','S6-GR3P6K',6,'String','Trifásico','17de8315-2e2f-4a79-8751-e5d507d69a41',true,'publicado'),
('SOLIS','S6-GR3P8K',8,'String','Trifásico','17de8315-2e2f-4a79-8751-e5d507d69a41',true,'publicado'),
('SOLIS','S6-GR3P12K',12,'String','Trifásico','17de8315-2e2f-4a79-8751-e5d507d69a41',true,'publicado'),
('SOLIS','S6-GR3P17K',17,'String','Trifásico','17de8315-2e2f-4a79-8751-e5d507d69a41',true,'publicado'),
('SOLIS','S6-GR3P20K',20,'String','Trifásico','17de8315-2e2f-4a79-8751-e5d507d69a41',true,'publicado')
ON CONFLICT DO NOTHING;