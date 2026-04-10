-- Enable Realtime for tables that need subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE propostas_nativas;
ALTER PUBLICATION supabase_realtime ADD TABLE proposta_versoes;
ALTER PUBLICATION supabase_realtime ADD TABLE generated_documents;