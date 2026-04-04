-- Allow anonymous users to read proposta_versoes when linked to a valid token
CREATE POLICY "Anon read versao via valid token"
ON proposta_versoes FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposta_aceite_tokens t
    WHERE t.versao_id = proposta_versoes.id
      AND t.expires_at > now()
      AND t.invalidado_em IS NULL
  )
);

-- Allow anonymous users to read propostas_nativas when linked to a valid token
CREATE POLICY "Anon read proposta via valid token"
ON propostas_nativas FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposta_aceite_tokens t
    WHERE t.proposta_id = propostas_nativas.id
      AND t.expires_at > now()
      AND t.invalidado_em IS NULL
  )
);

-- Allow anonymous users to read proposta_templates linked to a valid versão/token
CREATE POLICY "Anon read template via valid token"
ON proposta_templates FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM proposta_versoes v
    JOIN proposta_aceite_tokens t ON t.versao_id = v.id
    WHERE v.template_id_used = proposta_templates.id
      AND t.expires_at > now()
      AND t.invalidado_em IS NULL
  )
);