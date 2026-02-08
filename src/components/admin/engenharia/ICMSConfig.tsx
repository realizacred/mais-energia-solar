import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Landmark, Save, Loader2, Search, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TributariaEstado {
  id: string;
  estado: string;
  aliquota_icms: number;
  possui_isencao_scee: boolean;
  percentual_isencao: number;
  observacoes: string | null;
}

export function ICMSConfig() {
  const [items, setItems] = useState<TributariaEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("config_tributaria_estado")
        .select("*")
        .order("estado", { ascending: true });
      if (error) throw error;
      setItems(
        (data || []).map((d) => ({
          id: d.id,
          estado: d.estado,
          aliquota_icms: Number(d.aliquota_icms),
          possui_isencao_scee: d.possui_isencao_scee,
          percentual_isencao: Number(d.percentual_isencao),
          observacoes: d.observacoes,
        }))
      );
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (item: TributariaEstado) => {
    setSaving(item.id);
    try {
      const { error } = await supabase
        .from("config_tributaria_estado")
        .update({
          aliquota_icms: item.aliquota_icms,
          possui_isencao_scee: item.possui_isencao_scee,
          percentual_isencao: item.percentual_isencao,
          observacoes: item.observacoes,
        })
        .eq("id", item.id);
      if (error) throw error;
      toast({ title: `${item.estado} atualizado` });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const updateItem = (id: string, field: keyof TributariaEstado, value: any) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const filtered = items.filter(
    (i) =>
      searchTerm === "" ||
      i.estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.observacoes && i.observacoes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const comIsencao = items.filter((i) => i.possui_isencao_scee).length;
  const semIsencao = items.filter((i) => !i.possui_isencao_scee).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-secondary" />
          <CardTitle>Configuração Tributária por Estado</CardTitle>
        </div>
        <CardDescription className="flex items-center gap-3 flex-wrap">
          ICMS e isenção SCEE para cálculo de payback profissional.
          <Badge variant="outline" className="text-success border-success/30">
            {comIsencao} com isenção
          </Badge>
          <Badge variant="outline" className="text-destructive border-destructive/30">
            {semIsencao} sem isenção
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info */}
        <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-2">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            A isenção SCEE define se o ICMS é cobrado sobre a energia compensada na GD. Estados que
            aderiram ao Convênio ICMS 16/2015 concedem isenção total ou parcial. O cenário otimista
            aplica a isenção; o conservador, não.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">UF</TableHead>
                <TableHead className="w-24">ICMS (%)</TableHead>
                <TableHead className="w-28">Isenção SCEE</TableHead>
                <TableHead className="w-24">% Isenção</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right w-20">Salvar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {item.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={40}
                      className="w-20 h-8"
                      value={item.aliquota_icms}
                      onChange={(e) =>
                        updateItem(item.id, "aliquota_icms", parseFloat(e.target.value) || 0)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.possui_isencao_scee}
                      onCheckedChange={(v) => updateItem(item.id, "possui_isencao_scee", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 h-8"
                      value={item.percentual_isencao}
                      onChange={(e) =>
                        updateItem(item.id, "percentual_isencao", parseFloat(e.target.value) || 0)
                      }
                      disabled={!item.possui_isencao_scee}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={item.observacoes || ""}
                      onChange={(e) => updateItem(item.id, "observacoes", e.target.value)}
                      placeholder="Notas..."
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSave(item)}
                      disabled={saving === item.id}
                    >
                      {saving === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
