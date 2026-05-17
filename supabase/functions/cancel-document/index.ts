import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, rgb, degrees, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { document_id, motivo } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Buscar metadados do documento
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) throw new Error("Documento não encontrado");
    if (!doc.pdf_path) throw new Error("Documento não possui PDF");

    // 2. Baixar PDF original
    const { data: pdfData, error: dlErr } = await supabase.storage
      .from("document-files")
      .download(doc.pdf_path);

    if (dlErr || !pdfData) throw new Error("Erro ao baixar PDF original");

    const existingPdfBytes = await pdfData.arrayBuffer();

    // 3. Manipular PDF com pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const watermarkText = `CANCELADO - ${motivo?.toUpperCase() || "GERAL"} - ${new Date().toLocaleDateString("pt-BR")}`;

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Desenhar faixa diagonal
      page.drawText(watermarkText, {
        x: width / 4,
        y: height / 2,
        size: 30,
        font: helveticaBold,
        color: rgb(0.9, 0.1, 0.1),
        rotate: degrees(45),
        opacity: 0.4,
      });

      // Borda vermelha opcional
      page.drawRectangle({
        x: 10,
        y: 10,
        width: width - 20,
        height: height - 20,
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 2,
        opacity: 0.2,
      });
    }

    const pdfBytes = await pdfDoc.save();

    // 4. Salvar novo arquivo no storage
    const newPath = `${doc.pdf_path.replace(".pdf", "")}_CANCELADO.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("document-files")
      .upload(newPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // 5. Gerar URL pública/assinada
    const { data: urlData } = await supabase.storage
      .from("document-files")
      .createSignedUrl(newPath, 3600 * 24 * 365); // 1 ano

    // 6. Atualizar documento
    await supabase
      .from("generated_documents")
      .update({
        pdf_cancelado_url: urlData?.signedUrl || null,
        status: "cancelled"
      } as any)
      .eq("id", document_id);

    return new Response(JSON.stringify({ success: true, path: newPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cancel-document] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
