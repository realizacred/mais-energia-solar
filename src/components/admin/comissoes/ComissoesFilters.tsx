import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";

interface Vendedor {
  id: string;
  nome: string;
}

interface Cliente {
  id: string;
  nome: string;
}

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

interface ComissoesFiltersProps {
  filterMes: number;
  setFilterMes: (mes: number) => void;
  filterAno: number;
  setFilterAno: (ano: number) => void;
  filterVendedor: string;
  setFilterVendedor: (vendedor: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterCliente: string;
  setFilterCliente: (cliente: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  vendedores: Vendedor[];
  clientes: Cliente[];
  anos: number[];
  onClearFilters: () => void;
}

export function ComissoesFilters({
  filterMes,
  setFilterMes,
  filterAno,
  setFilterAno,
  filterVendedor,
  setFilterVendedor,
  filterStatus,
  setFilterStatus,
  filterCliente,
  setFilterCliente,
  searchTerm,
  setSearchTerm,
  vendedores,
  clientes,
  anos,
  onClearFilters,
}: ComissoesFiltersProps) {
  const hasActiveFilters = 
    filterVendedor !== "all" || 
    filterStatus !== "all" || 
    filterCliente !== "all" ||
    searchTerm !== "";

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição, vendedor ou projeto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchTerm("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filters grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={filterMes.toString()} onValueChange={(v) => setFilterMes(parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={filterAno.toString()} onValueChange={(v) => setFilterAno(parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={a.toString()}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Vendedor</Label>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={filterCliente} onValueChange={setFilterCliente}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">&nbsp;</Label>
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClearFilters} className="w-full gap-2">
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
