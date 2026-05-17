
import { Docx } from "https://deno.land/x/docx@v8.1.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

async function generateRecibo(tipo: string) {
  const doc = new Docx.Document({
    sections: [
      {
        properties: {},
        children: [
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({
                text: `RECIBO DE ${tipo.toUpperCase()}`,
                bold: true,
                size: 32,
              }),
            ],
            alignment: Docx.AlignmentType.CENTER,
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({
                text: "─────────────────────────────────────",
              }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({
                text: "Nº {numero_recibo}          Data: {data_pagamento}",
              }),
            ],
          }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "RECEBEMOS DE:", bold: true }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Nome: {cliente_nome}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "CPF/CNPJ: {cliente_cpf_cnpj}" }),
            ],
          }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "O VALOR DE:", bold: true }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "R$ {valor_recibo} ({valor_por_extenso})" }),
            ],
          }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "REFERENTE A:", bold: true }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "{descricao}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Projeto: {projeto_nome}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Valor total da obra: {projeto_valor_total}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Saldo devedor após este recibo: {saldo_devedor}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Forma de pagamento: {forma_pagamento}" }),
            ],
          }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({
                text: "─────────────────────────────────────",
              }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "{empresa_nome}", bold: true }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "CNPJ: {empresa_cnpj}" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "{empresa_endereco}" }),
            ],
          }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({ text: "" }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "Ass: ________________________" }),
            ],
          }),
          new Docx.Paragraph({
            children: [
              new Docx.TextRun({ text: "{empresa_responsavel}" }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Docx.Packer.toBuffer(doc);
  return buffer;
}

async function main() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tipos = ["sinal", "parcela", "quitacao"];

  for (const tipo of tipos) {
    console.log(`Gerando template recibo-${tipo}.docx...`);
    const buffer = await generateRecibo(tipo);
    const path = `templates/recibo-${tipo}.docx`;

    const { error: uploadError } = await supabase.storage
      .from("generated-documents")
      .upload(path, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      console.error(`Erro ao subir ${path}:`, uploadError);
    } else {
      console.log(`${path} enviado com sucesso.`);
      
      const { error: updateError } = await supabase
        .from("document_templates")
        .update({ 
          arquivo_base_path: path,
          docx_storage_path: path // Updating both for safety
        })
        .ilike("nome", `%recibo%${tipo}%`);
      
      if (updateError) {
        console.error(`Erro ao atualizar document_templates para ${tipo}:`, updateError);
      }
    }
  }

  // Generate Contrato Padrão
  console.log("Gerando template contrato-padrao.docx...");
  const contratoDoc = new Docx.Document({
    sections: [{
      children: [
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "{empresa_nome}", bold: true, size: 28 })],
          alignment: Docx.AlignmentType.CENTER
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", bold: true, size: 24 })],
          alignment: Docx.AlignmentType.CENTER
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "CONTRATADA: ", bold: true }), new Docx.TextRun({ text: "{empresa_nome}, CNPJ {empresa_cnpj}, com sede em {empresa_endereco}." })]
        }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "CONTRATANTE: ", bold: true }), new Docx.TextRun({ text: "{cliente_nome}, CPF/CNPJ {cliente_cpf_cnpj}, residente em {cliente_endereco}, {cliente_numero} - {cliente_cidade}/{cliente_estado}." })]
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "CLÁUSULA 1 - OBJETO", bold: true })]
        }),
        new Docx.Paragraph({
          text: "O presente contrato tem como objeto a instalação de sistema de energia solar fotovoltaica com potência de {projeto_potencia}."
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "CLÁUSULA 2 - VALOR E PAGAMENTO", bold: true })]
        }),
        new Docx.Paragraph({
          text: "O valor total do projeto é de R$ {valor_total}, sendo pago da seguinte forma: {pagamento_forma_descrita}."
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({
          children: [new Docx.TextRun({ text: "ASSINATURAS", bold: true })]
        }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({ text: "____________________________________" }),
        new Docx.Paragraph({ text: "{empresa_nome}" }),
        new Docx.Paragraph({ text: "" }),
        new Docx.Paragraph({ text: "____________________________________" }),
        new Docx.Paragraph({ text: "{cliente_nome}" }),
      ]
    }]
  });

  const contratoBuffer = await Docx.Packer.toBuffer(contratoDoc);
  const contratoPath = "templates/contrato-padrao.docx";
  await supabase.storage.from("generated-documents").upload(contratoPath, contratoBuffer, { upsert: true });
  console.log("Contrato padrão enviado.");
}

main();
