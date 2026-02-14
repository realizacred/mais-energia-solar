-- Insert default SLA config for Mais Energia Solar tenant
INSERT INTO wa_sla_config (tenant_id, ativo, prazo_resposta_minutos, escalonar_apos_minutos, alerta_sonoro, alerta_visual, gerar_resumo_ia, horario_comercial_inicio, horario_comercial_fim, ignorar_fora_horario)
VALUES ('00000000-0000-0000-0000-000000000001', true, 60, 240, true, true, true, '08:00', '18:00', false)
ON CONFLICT (tenant_id) DO NOTHING;
