-- Insert transformadores
INSERT INTO transformadores (potencia_kva, descricao, ativo) VALUES
  (0, 'Urbano', true),
  (5, '5kVA', true),
  (10, '10kVA', true),
  (15, '15kVA', true),
  (20, '20kVA', true),
  (25, '25kVA', true),
  (35, '35kVA', true);

-- Insert disjuntores
INSERT INTO disjuntores (amperagem, descricao, ativo) VALUES
  (30, 'Mono 30A', true),
  (40, 'Mono 40A', true),
  (50, 'Mono 50A', true),
  (40, 'Bifásico 40A', true),
  (50, 'Bifásico 50A', true),
  (63, 'Bifásico 63A', true),
  (70, 'Bifásico 70A', true),
  (80, 'Bifásico 80A', true),
  (100, 'Bifásico 100A', true),
  (120, 'Bifásico 120A', true),
  (40, 'Trifásico 40A', true),
  (50, 'Trifásico 50A', true),
  (63, 'Trifásico 63A', true),
  (70, 'Trifásico 70A', true),
  (80, 'Trifásico 80A', true),
  (100, 'Trifásico 100A', true),
  (110, 'Trifásico 110A', true),
  (120, 'Trifásico 120A', true),
  (150, 'Trifásico 150A', true),
  (200, 'Trifásico 200A', true);