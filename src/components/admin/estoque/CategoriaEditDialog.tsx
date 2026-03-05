import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { useCreateEstoqueCategoria, useUpdateEstoqueCategoria, type EstoqueCategoria } from "@/hooks/useEstoqueCategorias";

interface CategoriaEditDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categoria: EstoqueCategoria | null;
  parentId: string | null;
  allCategorias: EstoqueCategoria[];
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function CategoriaEditDialog({ open, onOpenChange, categoria, parentId, allCategorias }: CategoriaEditDialogProps) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>("none");
  const [autoSlug, setAutoSlug] = useState(true);

  const createMut = useCreateEstoqueCategoria();
  const updateMut = useUpdateEstoqueCategoria();
  const isEdit = !!categoria;

  useEffect(() => {
    if (categoria) {
      setNome(categoria.nome);
      setSlug(categoria.slug);
      setSelectedParent(categoria.parent_id || "none");
      setAutoSlug(false);
    } else {
      setNome("");
      setSlug("");
      setSelectedParent(parentId || "none");
      setAutoSlug(true);
    }
  }, [categoria, parentId, open]);

  useEffect(() => {
    if (autoSlug && nome) setSlug(slugify(nome));
  }, [nome, autoSlug]);

  const parents = allCategorias.filter((c) => !c.parent_id && c.ativo && c.id !== categoria?.id);

  const handleSubmit = () => {
    if (!nome.trim() || !slug.trim()) return;
    const payload = {
      nome: nome.trim(),
      slug: slug.trim(),
      parent_id: selectedParent === "none" ? null : selectedParent,
    };
    if (isEdit) {
      updateMut.mutate({ id: categoria.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createMut.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar Categoria" : (selectedParent !== "none" ? "Nova Subcategoria" : "Nova Categoria")}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? "Salvar" : "Criar"}
      saving={createMut.isPending || updateMut.isPending}
      disabled={!nome.trim() || !slug.trim()}
      asForm
    >
      <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Estrutura Metálica" /></div>
      <div>
        <Label>Slug (identificador)</Label>
        <Input value={slug} onChange={(e) => { setSlug(e.target.value); setAutoSlug(false); }} placeholder="ex: estrutura_metalica" />
      </div>
      <div>
        <Label>Categoria pai</Label>
        <Select value={selectedParent} onValueChange={setSelectedParent}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma (categoria raiz)</SelectItem>
            {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </FormModalTemplate>
  );
}
