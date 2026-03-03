-- Re-enqueue 4 orphaned forwarded messages that were never added to outbox
-- This is a one-time data fix

SELECT enqueue_wa_outbox_item(
  p_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid,
  p_instance_id := '453fcf8f-1849-466f-80a9-535fbff0462d'::uuid,
  p_remote_jid := '553288237180@s.whatsapp.net',
  p_message_type := 'document',
  p_content := '↪️ *Encaminhada*
CNH-e.pdf.pdf',
  p_media_url := 'https://bguhckqkpnziykpbwbeu.supabase.co/storage/v1/object/public/wa-attachments/00000000-0000-0000-0000-000000000001/media/AC44541B93D217E0668B9CD484294C27.pdf',
  p_conversation_id := '93a5284a-74dd-4f3b-9b3e-19c4e5bb341e'::uuid,
  p_message_id := '88a02d53-e45a-44c6-b52c-2f7e7a556975'::uuid,
  p_idempotency_key := 'repair_forward_88a02d53'
);

SELECT enqueue_wa_outbox_item(
  p_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid,
  p_instance_id := '453fcf8f-1849-466f-80a9-535fbff0462d'::uuid,
  p_remote_jid := '553288237180@s.whatsapp.net',
  p_message_type := 'document',
  p_content := '↪️ *Encaminhada*
energisa_2via61deb68e-ebed-43b9-ae47-1e907308bf8e.pdf',
  p_media_url := 'https://bguhckqkpnziykpbwbeu.supabase.co/storage/v1/object/public/wa-attachments/00000000-0000-0000-0000-000000000001/media/ACD1B10E0C4DF2DE250E7E51A5ADECB0.pdf',
  p_conversation_id := '93a5284a-74dd-4f3b-9b3e-19c4e5bb341e'::uuid,
  p_message_id := '185537ea-0f11-4d43-b146-f8d3a6fb03ca'::uuid,
  p_idempotency_key := 'repair_forward_185537ea'
);

SELECT enqueue_wa_outbox_item(
  p_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid,
  p_instance_id := '453fcf8f-1849-466f-80a9-535fbff0462d'::uuid,
  p_remote_jid := '553298388000@s.whatsapp.net',
  p_message_type := 'image',
  p_content := '↪️ *Encaminhada*
image.png',
  p_media_url := 'https://bguhckqkpnziykpbwbeu.supabase.co/storage/v1/object/public/wa-attachments/00000000-0000-0000-0000-000000000001/bd5e67cd-2c31-431d-86ed-f8655c7d824c/1772539725370.png',
  p_conversation_id := 'f9bc5f94-507f-4aab-9543-e7a7db94b010'::uuid,
  p_message_id := '68033140-a79e-408d-951a-72e8a8c8693f'::uuid,
  p_idempotency_key := 'repair_forward_68033140'
);

SELECT enqueue_wa_outbox_item(
  p_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid,
  p_instance_id := '453fcf8f-1849-466f-80a9-535fbff0462d'::uuid,
  p_remote_jid := '553298388000@s.whatsapp.net',
  p_message_type := 'image',
  p_content := '↪️ *Encaminhada*
image.png',
  p_media_url := 'https://bguhckqkpnziykpbwbeu.supabase.co/storage/v1/object/public/wa-attachments/00000000-0000-0000-0000-000000000001/bd5e67cd-2c31-431d-86ed-f8655c7d824c/1772539708375.png',
  p_conversation_id := 'f9bc5f94-507f-4aab-9543-e7a7db94b010'::uuid,
  p_message_id := '4f396213-9751-48cc-aef3-a99756419ea9'::uuid,
  p_idempotency_key := 'repair_forward_4f396213'
);