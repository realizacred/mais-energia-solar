## Correção cirúrgica: bug de upload em `CustomFieldFileInput.tsx`

### Causa
Em `handleUpload` (linhas 109-112), `e.target.value = ""` é executado **antes** da verificação `fileList.length === 0`. Como `e.target.files` é uma referência viva ao `<input>`, limpar o `value` zera o `FileList` no mesmo tick → early-return silencioso em 100% dos uploads.

### Mudança (única, no arquivo `src/components/admin/projetos/CustomFieldFileInput.tsx`)

Substituir o bloco linhas 109-166 por:

```ts
async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files ? Array.from(e.target.files) : [];
  if (files.length === 0 || !dealId) {
    e.target.value = "";
    return;
  }
  setBusy(true);
  let tenantId: string | null = null;
  let currentPath: string | null = null;
  let currentFile: File | null = null;
  try {
    tenantId = await getTenantId();
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const uploaded: CustomFieldFileMeta[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      currentFile = file;
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${tenantId}/deals/${dealId}/custom-fields/${fieldKey}/${Date.now()}_${i}_${safeName}`;
      currentPath = path;
      const { error } = await supabase.storage
        .from("projeto-documentos")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      uploaded.push({
        storage_path: path,
        filename: file.name,
        mime: file.type || undefined,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        uploaded_by: userId,
      });
    }
    await persist([...items, ...uploaded]);
    toast({ title: uploaded.length === 1 ? "Arquivo enviado" : `${uploaded.length} arquivos enviados` });
  } catch (err: any) {
    console.error("[CustomFieldFileInput] upload error:", err);
    const diag = await logUploadDiagnostics({
      section: "Campos importantes",
      bucket: "projeto-documentos",
      path: currentPath,
      tenant_id: tenantId,
      field_key: fieldKey,
      field_type: "file",
      deal_id: dealId ?? null,
      file_name: currentFile?.name ?? null,
      file_size: currentFile?.size ?? null,
      file_mime: currentFile?.type ?? null,
      error: err,
    });
    const status = diag?.errorInfo?.status ? ` [HTTP ${diag.errorInfo.status}]` : "";
    toast({
      title: "Erro ao enviar",
      description: `${err?.message || String(err)}${status} — ver console [ProjectUploadDiagnostics]`,
      variant: "destructive",
    });
  } finally {
    e.target.value = "";
    setBusy(false);
  }
}
```

### Resumo das alterações
- `fileList` (FileList vivo) → `files` (Array snapshot via `Array.from`)
- `e.target.value = ""` movido para `finally` (e duplicado no early-return)
- Loop `for` agora itera sobre `files`
- Nenhuma outra função do arquivo é tocada

### Validação
- Build automático (sem erros esperados — mudança puramente local)
- Teste manual: selecionar arquivo em "Campos importantes" → deve subir para `projeto-documentos` e aparecer o toast
