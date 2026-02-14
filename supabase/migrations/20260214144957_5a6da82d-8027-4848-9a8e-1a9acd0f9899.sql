
-- Seed 3 default templates (Modern, Corporate, Compact)
INSERT INTO public.proposta_templates (tenant_id, nome, descricao, tipo, categoria, ordem, template_html, ativo)
SELECT t.id, tpl.nome, tpl.descricao, 'html', tpl.categoria, tpl.ordem, tpl.tpl_html, true
FROM tenants t
CROSS JOIN (
  VALUES
    ('Moderno & Limpo', 'Layout minimalista com foco em dados e gráficos', 'moderno', 1,
     '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;color:#1a1a2e;background:#fff;max-width:800px;margin:0 auto}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px;border-radius:0 0 24px 24px}.header h1{font-size:28px;font-weight:700}.header p{opacity:.85;margin-top:8px}.section{padding:32px 40px}.section h2{font-size:18px;font-weight:600;color:#667eea;margin-bottom:16px;border-bottom:2px solid #667eea33;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:#f8f9ff;border-radius:12px;padding:20px}.card .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}.card .value{font-size:24px;font-weight:700;color:#1a1a2e}.table{width:100%;border-collapse:collapse;margin-top:12px}.table th{background:#667eea;color:#fff;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase}.table td{padding:10px 14px;border-bottom:1px solid #eee;font-size:13px}.footer{background:#f8f9ff;padding:32px 40px;text-align:center;color:#888;font-size:12px;border-radius:24px 24px 0 0;margin-top:20px}</style></head><body><div class="header"><h1>Proposta Solar</h1><p>{{cliente_nome}} - {{potencia_kwp}} kWp</p></div><div class="section"><h2>Resumo do Investimento</h2><div class="grid"><div class="card"><div class="label">Investimento Total</div><div class="value">{{valor_total}}</div></div><div class="card"><div class="label">Economia Mensal</div><div class="value">{{economia_mensal}}</div></div><div class="card"><div class="label">Payback</div><div class="value">{{payback_meses}} meses</div></div><div class="card"><div class="label">Potência</div><div class="value">{{potencia_kwp}} kWp</div></div></div></div><div class="section"><h2>Equipamentos</h2><table class="table"><tr><th>Item</th><th>Qtd</th><th>Valor</th></tr></table></div><div class="footer"><p>Proposta válida até {{valido_ate}}</p><p style="margin-top:8px">{{empresa_nome}}</p></div></body></html>'),
    ('Premium Corporativo', 'Visual sofisticado com seções bem demarcadas para B2B', 'corporativo', 2,
     '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;color:#2d3436;background:#fff;max-width:800px;margin:0 auto}.cover{background:#2d3436;color:#fff;padding:60px 48px;position:relative}.cover::after{content:"";position:absolute;bottom:0;left:48px;right:48px;height:3px;background:linear-gradient(90deg,#fdcb6e,#e17055)}.cover h1{font-size:32px;font-weight:400;letter-spacing:-0.5px}.cover .subtitle{font-size:14px;margin-top:12px;opacity:.7;letter-spacing:2px;text-transform:uppercase}.section{padding:36px 48px}.section h2{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#2d3436;margin-bottom:20px;position:relative;padding-left:16px}.section h2::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#fdcb6e}.metric-row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #dfe6e9}.metric-row .k{font-size:13px;color:#636e72}.metric-row .v{font-size:16px;font-weight:700}.footer{border-top:3px solid #2d3436;padding:28px 48px;font-size:11px;color:#636e72;text-align:center}</style></head><body><div class="cover"><h1>Proposta Comercial</h1><div class="subtitle">Energia Solar Fotovoltaica</div><p style="margin-top:24px;font-size:18px">{{cliente_nome}}</p></div><div class="section"><h2>Dados do Projeto</h2><div class="metric-row"><span class="k">Potência do Sistema</span><span class="v">{{potencia_kwp}} kWp</span></div><div class="metric-row"><span class="k">Investimento Total</span><span class="v">{{valor_total}}</span></div><div class="metric-row"><span class="k">Economia Mensal</span><span class="v">{{economia_mensal}}</span></div><div class="metric-row"><span class="k">Retorno</span><span class="v">{{payback_meses}} meses</span></div></div><div class="footer"><p>Válida até {{valido_ate}} - {{empresa_nome}}</p></div></body></html>'),
    ('Compacto (1-2 páginas)', 'Resumo direto ao ponto com dados essenciais', 'compacto', 3,
     '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#333;background:#fff;max-width:700px;margin:0 auto;padding:24px;font-size:13px}.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #333}.top h1{font-size:20px;font-weight:700}.top .meta{text-align:right;font-size:11px;color:#666}.row{display:flex;gap:12px;margin-bottom:12px}.box{flex:1;background:#f5f5f5;border-radius:8px;padding:14px}.box .l{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.5px}.box .v{font-size:18px;font-weight:700;margin-top:2px}.ft{margin-top:24px;text-align:center;font-size:10px;color:#999}</style></head><body><div class="top"><div><h1>Proposta Solar</h1><p>{{cliente_nome}}</p></div><div class="meta"><p>{{potencia_kwp}} kWp</p><p>Válida até {{valido_ate}}</p></div></div><div class="row"><div class="box"><div class="l">Investimento</div><div class="v">{{valor_total}}</div></div><div class="box"><div class="l">Economia/mês</div><div class="v">{{economia_mensal}}</div></div><div class="box"><div class="l">Payback</div><div class="v">{{payback_meses}}m</div></div></div><div class="ft">{{empresa_nome}}</div></body></html>')
) AS tpl(nome, descricao, categoria, ordem, tpl_html)
WHERE NOT EXISTS (
  SELECT 1 FROM proposta_templates pt WHERE pt.tenant_id = t.id AND pt.categoria = tpl.categoria
);

-- Storage bucket for signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-signatures', 'proposal-signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant users can upload signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proposal-signatures'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Tenant users can read signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proposal-signatures'
);
