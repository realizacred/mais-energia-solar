-- Resolve incorrect low voltage alert (124.6V is normal for 127V network)
UPDATE meter_alerts 
SET resolvido = true,
    resolvido_at = NOW()
WHERE tipo = 'tensao_baixa'
AND valor_limite = 200
AND valor_atual > 110
AND resolvido = false;