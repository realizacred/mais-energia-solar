-- Create a temporary function to seed IBGE data
-- This approach avoids exceeding payload limits
CREATE OR REPLACE FUNCTION public._seed_ibge_municipios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data jsonb;
BEGIN
  -- Check if data already exists
  IF (SELECT COUNT(*) FROM municipios_ibge) > 100 THEN
    RAISE NOTICE 'IBGE data already seeded, skipping';
    RETURN;
  END IF;

  -- We'll insert a representative sample to validate the structure works
  -- Full data will be loaded via the edge function ibge-seed
  INSERT INTO municipios_ibge (codigo_ibge, nome, nome_normalizado, uf_sigla, uf_codigo, regiao) VALUES
  ('1100205','Porto Velho','porto velho','RO','11','Norte'),
  ('1200401','Rio Branco','rio branco','AC','12','Norte'),
  ('1302603','Manaus','manaus','AM','13','Norte'),
  ('1400100','Boa Vista','boa vista','RR','14','Norte'),
  ('1501402','Belém','belem','PA','15','Norte'),
  ('1600303','Macapá','macapa','AP','16','Norte'),
  ('1721000','Palmas','palmas','TO','17','Norte'),
  ('2111300','São Luís','sao luis','MA','21','Nordeste'),
  ('2211001','Teresina','teresina','PI','22','Nordeste'),
  ('2304400','Fortaleza','fortaleza','CE','23','Nordeste'),
  ('2408102','Natal','natal','RN','24','Nordeste'),
  ('2507507','João Pessoa','joao pessoa','PB','25','Nordeste'),
  ('2611606','Recife','recife','PE','26','Nordeste'),
  ('2704302','Maceió','maceio','AL','27','Nordeste'),
  ('2800308','Aracaju','aracaju','SE','28','Nordeste'),
  ('2927408','Salvador','salvador','BA','29','Nordeste'),
  ('3106200','Belo Horizonte','belo horizonte','MG','31','Sudeste'),
  ('3205309','Vitória','vitoria','ES','32','Sudeste'),
  ('3304557','Rio de Janeiro','rio de janeiro','RJ','33','Sudeste'),
  ('3550308','São Paulo','sao paulo','SP','35','Sudeste'),
  ('4106902','Curitiba','curitiba','PR','41','Sul'),
  ('4205407','Florianópolis','florianopolis','SC','42','Sul'),
  ('4314902','Porto Alegre','porto alegre','RS','43','Sul'),
  ('5002704','Campo Grande','campo grande','MS','50','Centro-Oeste'),
  ('5103403','Cuiabá','cuiaba','MT','51','Centro-Oeste'),
  ('5208707','Goiânia','goiania','GO','52','Centro-Oeste'),
  ('5300108','Brasília','brasilia','DF','53','Centro-Oeste')
  ON CONFLICT (codigo_ibge) DO NOTHING;
END;
$$;

-- Execute the seed
SELECT public._seed_ibge_municipios();

-- Drop the temporary function
DROP FUNCTION public._seed_ibge_municipios();