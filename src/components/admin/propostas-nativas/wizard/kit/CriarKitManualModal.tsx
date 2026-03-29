import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Plus, Trash2, SunMedium, Cable, Zap, BatteryCharging, Check, ChevronsUpDown, X, Package, Boxes } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui-kit/inputs";
import { type KitItemRow, formatBRL } from "../types";
import { formatKwp } from "@/lib/formatters/index";
import { useFornecedoresNomes } from "@/hooks/useFornecedoresNomes";

interface CatalogoModulo {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
}
interface CatalogoInversor {
  id: string; fabricante: string; modelo: string; potencia_nominal_kw: number | null;
  tipo: string | null; fases: string | null;
}
interface CatalogoOtimizador {
  id: string; fabricante: string; modelo: string; potencia_wp: number | null;
  eficiencia_percent: number | null; compatibilidade: string | null;
}
interface CatalogoBateria {
  id: string; fabricante: string; modelo: string; energia_kwh: number | null;
  tensao_nominal_v: number | null; tipo_bateria: string | null;
}

interface InversorEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
  fases: string;
  tensaoLinha: number;
}

interface ModuloEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
}

interface OtimizadorEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  potenciaW: number;
}

interface BateriaEntry {
  id: string;
  selectedId: string;
  quantidade: number;
  avulso: boolean;
  nome: string;
  fabricante: string;
  energiaKwh: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modulos: CatalogoModulo[];
  inversores: CatalogoInversor[];
  otimizadores?: CatalogoOtimizador[];
  baterias?: CatalogoBateria[];
  onKitCreated: (itens: KitItemRow[], meta?: KitMeta) => void;
  mode: "equipamentos" | "zero";
  sistema?: "on_grid" | "hibrido" | "off_grid";
  topologias?: string[];
  initialItens?: KitItemRow[];
  initialCardData?: KitMeta;
}

export interface KitMeta {
  distribuidorNome?: string;
  nomeKit?: string;
  codigoKit?: string;
  catalogKitId?: string;
  topologia?: string;
  custo?: number;
  sistema?: "on_grid" | "hibrido" | "off_grid";
  custosEmbutidos?: { estruturas: boolean; transformador: boolean };
}

const TOPOLOGIAS = ["Tradicional", "Microinversor", "Otimizador"];

/** Searchable equipment combo with highlight, keyboard nav, badge */
interface SearchableOption { value: string; label: string; searchText: string }

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const terms = query.trim().toLowerCase().split(/\s+/);
  // Build a regex that matches any of the terms
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary font-medium rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function SearchableEquipSelect({ value, onValueChange, options, placeholder, emptyText, className }: {
  value: string; onValueChange: (v: string) => void;
  options: SearchableOption[]; placeholder: string; emptyText: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const selectedOption = options.find(o => o.value === value);

  // Filter options by search (150ms debounce handled inline since cmdk is gone)
  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 50);
    const terms = search.toLowerCase().split(/\s+/);
    return options.filter(o => terms.every(t => o.searchText.toLowerCase().includes(t))).slice(0, 50);
  }, [options, search]);

  // Reset focused index when filtered list changes
  useEffect(() => { setFocusedIdx(-1); }, [filtered.length, search]);

  const handleSelect = useCallback((val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch("");
    setFocusedIdx(-1);
  }, [onValueChange]);

  const handleClear = useCallback(() => {
    onValueChange("");
    setSearch("");
    setFocusedIdx(-1);
    // Re-open for new search
    setTimeout(() => {
      setOpen(true);
      inputRef.current?.focus();
    }, 50);
  }, [onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIdx(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIdx(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIdx >= 0 && focusedIdx < filtered.length) {
          handleSelect(filtered[focusedIdx].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSearch("");
        break;
    }
  }, [open, focusedIdx, filtered, handleSelect]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIdx] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIdx]);

  // If value is selected, show badge mode
  if (value && selectedOption) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="flex-1 flex items-center gap-1 h-8 px-2 rounded-md border border-primary/20 bg-primary/5">
          <span className="text-xs text-primary font-medium truncate flex-1">{selectedOption.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-primary/60 hover:text-primary hover:bg-primary/10"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={search}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimeout.current = setTimeout(() => setOpen(false), 200); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 text-xs"
        autoComplete="off"
      />
      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          onMouseDown={e => e.preventDefault()} // prevent blur
        >
          <div ref={listRef} className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">{emptyText}</p>
            ) : (
              filtered.map((o, idx) => (
                <div
                  key={o.value}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer transition-colors",
                    idx === focusedIdx && "bg-primary/10 border-l-2 border-primary",
                    idx !== focusedIdx && "hover:bg-muted/60 border-l-2 border-transparent",
                    value === o.value && "font-medium"
                  )}
                  onClick={() => handleSelect(o.value)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                >
                  <Check className={cn("h-3 w-3 shrink-0", value === o.value ? "opacity-100 text-primary" : "opacity-0")} />
                  <span className="truncate">{highlightMatch(o.label, search)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function createEmptyModulo(): ModuloEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 1, avulso: false, nome: "", fabricante: "", potenciaW: 0 };
}

function createEmptyInversor(): InversorEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 1, avulso: false, nome: "", fabricante: "", potenciaW: 0, fases: "", tensaoLinha: 0 };
}

function createEmptyOtimizador(): OtimizadorEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 1, avulso: false, nome: "", fabricante: "", potenciaW: 0 };
}

function createEmptyBateria(): BateriaEntry {
  return { id: crypto.randomUUID(), selectedId: "", quantidade: 1, avulso: false, nome: "", fabricante: "", energiaKwh: 0 };
}

/**
 * Filter inversores by topologia + sistema rules:
 * - Híbrido/Off grid sistema → only "Híbrido" type inverters
 * - Tradicional topologia → "String" type
 * - Microinversor topologia → "Microinversor" type
 * - Otimizador topologia → "String" type (otimizadores are separate)
 */
function filterInversores(
  inversores: CatalogoInversor[],
  sistema: string,
  topologia: string,
): CatalogoInversor[] {
  // Sistema override: Híbrido/Off grid → only Híbrido inverters
  if (sistema === "hibrido" || sistema === "off_grid") {
    return inversores.filter(i => i.tipo === "Híbrido");
  }

  // Topologia-based filtering for On grid
  switch (topologia) {
    case "Tradicional":
      return inversores.filter(i => i.tipo === "String");
    case "Microinversor":
      return inversores.filter(i => i.tipo === "Microinversor");
    case "Otimizador":
      return inversores.filter(i => i.tipo === "String");
    default:
      return inversores;
  }
}

export function CriarKitManualModal({ open, onOpenChange, modulos, inversores, otimizadores = [], baterias = [], onKitCreated, mode, sistema: sistemaProp, topologias: topologiasProp, initialItens, initialCardData }: Props) {
  // Derive initial values from initialItens when editing
  const initModulos = useMemo(() => {
    if (!initialItens) return [createEmptyModulo()];
    const mods = initialItens.filter(i => i.categoria === "modulo");
    if (mods.length === 0) return [createEmptyModulo()];
    return mods.map(m => {
      // Match by produto_ref (exact ID) first, then by fabricante+modelo
      const catalogMatch = modulos.find(c =>
        (m.produto_ref && c.id === m.produto_ref) ||
        (c.modelo === m.modelo && c.fabricante === m.fabricante)
      );
      return {
        id: crypto.randomUUID(),
        selectedId: catalogMatch?.id || "",
        quantidade: m.quantidade,
        avulso: m.avulso || !catalogMatch,
        nome: catalogMatch ? "" : (m.descricao || `${m.fabricante} ${m.modelo}`.trim()),
        fabricante: m.fabricante || "",
        potenciaW: m.potencia_w || 0,
      } as ModuloEntry;
    });
  }, [initialItens, modulos]);

  const initInversores = useMemo(() => {
    if (!initialItens) return [createEmptyInversor()];
    const invs = initialItens.filter(i => i.categoria === "inversor");
    if (invs.length === 0) return [createEmptyInversor()];
    return invs.map(inv => {
      // Match by produto_ref (exact ID) first, then by fabricante+modelo
      const catalogMatch = inversores.find(c =>
        (inv.produto_ref && c.id === inv.produto_ref) ||
        (c.modelo === inv.modelo && c.fabricante === inv.fabricante)
      );
      return {
        id: crypto.randomUUID(),
        selectedId: catalogMatch?.id || "",
        quantidade: inv.quantidade,
        avulso: inv.avulso || !catalogMatch,
        nome: catalogMatch ? "" : (inv.descricao || `${inv.fabricante} ${inv.modelo}`.trim()),
        fabricante: inv.fabricante || "",
        potenciaW: inv.potencia_w || 0,
        fases: "", tensaoLinha: 0,
      } as InversorEntry;
    });
  }, [initialItens, inversores]);

  const initOtimizadores = useMemo(() => {
    if (!initialItens) return [];
    const opts = initialItens.filter(i => i.categoria === "outros" && !i.avulso);
    return opts.map(ot => {
      const catalogMatch = otimizadores.find(c => c.modelo === ot.modelo && c.fabricante === ot.fabricante);
      return {
        id: crypto.randomUUID(),
        selectedId: catalogMatch?.id || "",
        quantidade: ot.quantidade,
        avulso: ot.avulso || !catalogMatch,
        nome: ot.modelo || "",
        fabricante: ot.fabricante || "",
        potenciaW: ot.potencia_w || 0,
      } as OtimizadorEntry;
    });
  }, [initialItens, otimizadores]);

  const initBaterias = useMemo(() => {
    if (!initialItens) return [];
    const bats = initialItens.filter(i => i.categoria === "bateria");
    return bats.map(b => {
      const catalogMatch = baterias.find(c => (b.produto_ref && c.id === b.produto_ref) || (c.modelo === b.modelo && c.fabricante === b.fabricante));
      return {
        id: crypto.randomUUID(),
        selectedId: catalogMatch?.id || "",
        quantidade: b.quantidade,
        avulso: b.avulso || !catalogMatch,
        nome: b.modelo || "",
        fabricante: b.fabricante || "",
        energiaKwh: b.potencia_w ? b.potencia_w / 1000 : 0,
      } as BateriaEntry;
    });
  }, [initialItens, baterias]);

  const initCusto = useMemo(() => {
    if (!initialItens) return 0;
    return initialItens.reduce((s, i) => s + (i.preco_unitario || 0) * i.quantidade, 0);
  }, [initialItens]);

  const [distribuidorNome, setDistribuidorNome] = useState(initialCardData?.distribuidorNome || "");
  const [distribuidorOpen, setDistribuidorOpen] = useState(false);
  const { data: fornecedoresList = [] } = useFornecedoresNomes();
  const fornecedoresFiltered = useMemo(() => {
    if (!distribuidorNome.trim()) return fornecedoresList.slice(0, 10);
    const q = distribuidorNome.toLowerCase();
    return fornecedoresList.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 10);
  }, [fornecedoresList, distribuidorNome]);
  const [custo, setCusto] = useState(initialCardData?.custo || 0);
  const [nomeKit, setNomeKit] = useState(initialCardData?.nomeKit || "");
  const [codigoKit, setCodigoKit] = useState(initialCardData?.codigoKit || "");
  const [sistema, setSistema] = useState<"on_grid" | "hibrido" | "off_grid">(initialCardData?.sistema || sistemaProp || "on_grid");
  const [tipoKit, setTipoKit] = useState<"customizado" | "fechado">("customizado");
  const [topologia, setTopologia] = useState(
    initialCardData?.topologia ||
    (topologiasProp?.length === 1
      ? (topologiasProp[0] === "tradicional" ? "Tradicional" : topologiasProp[0] === "microinversor" ? "Microinversor" : "Otimizador")
      : "Tradicional")
  );
  const [distribuidorSelect, setDistribuidorSelect] = useState("");
  const [custosEmbutidos, setCustosEmbutidos] = useState(initialCardData?.custosEmbutidos || { estruturas: false, transformador: false });

  const [moduloEntries, setModuloEntries] = useState<ModuloEntry[]>(initModulos);
  const [inversorEntries, setInversorEntries] = useState<InversorEntry[]>(initInversores);
  const [otimizadorEntries, setOtimizadorEntries] = useState<OtimizadorEntry[]>(initOtimizadores);
  const [bateriaEntries, setBateriaEntries] = useState<BateriaEntry[]>(initBaterias);
  const [componenteEntries, setComponenteEntries] = useState<{ id: string; nome: string; quantidade: number }[]>([]);
  const [triedSave, setTriedSave] = useState(false);

  // Reset form when initialItens changes (open for edit vs create)
  const [lastInitKey, setLastInitKey] = useState<string | null>(null);
  const initKey = initialItens ? initialItens.map(i => i.id).join(",") : "new";
  if (initKey !== lastInitKey && open) {
    setLastInitKey(initKey);
    setModuloEntries(initModulos);
    setInversorEntries(initInversores);
    setOtimizadorEntries(initOtimizadores);
    setBateriaEntries(initBaterias);
    // Prefer meta custo over calculated initCusto (catalog items have preco_unitario=0)
    setCusto(initialCardData?.custo || initCusto);
    // Restore header fields from card data
    if (initialCardData) {
      setDistribuidorNome(initialCardData.distribuidorNome || "");
      setNomeKit(initialCardData.nomeKit || "");
      setCodigoKit(initialCardData.codigoKit || "");
      if (initialCardData.topologia) setTopologia(initialCardData.topologia);
      if (initialCardData.sistema) setSistema(initialCardData.sistema);
      if (initialCardData.custosEmbutidos) setCustosEmbutidos(initialCardData.custosEmbutidos);
    }
  }

  // Filtered inversores based on sistema + topologia
  const filteredInversores = useMemo(
    () => filterInversores(inversores, sistema, topologia),
    [inversores, sistema, topologia]
  );

  // Show otimizadores section: always available (auto-added when topologia = Otimizador, optional otherwise)
  const showOtimizadores = otimizadorEntries.length > 0;

  const potenciaTotal = moduloEntries.reduce((s, m) => {
    if (m.avulso) return s + (m.potenciaW * m.quantidade) / 1000;
    const cat = modulos.find(c => c.id === m.selectedId);
    return s + ((cat?.potencia_wp || 0) * m.quantidade) / 1000;
  }, 0);

  const handleSave = () => {
    setTriedSave(true);
    // Validation
    const errors: string[] = [];
    if (!distribuidorNome.trim()) errors.push("Nome do distribuidor");
    if (!nomeKit.trim()) errors.push("Nome do Kit");
    if (!codigoKit.trim()) errors.push("Código do Kit");
    if (!topologia) errors.push("Topologia");

    const hasValidModulo = moduloEntries.some(m => m.avulso ? !!m.nome : !!m.selectedId);
    if (!hasValidModulo) errors.push("Pelo menos 1 módulo");

    const hasValidInversor = inversorEntries.some(inv => inv.avulso ? !!inv.nome : !!inv.selectedId);
    if (!hasValidInversor) errors.push("Pelo menos 1 inversor");

    // Check quantities > 0
    moduloEntries.forEach((m, i) => {
      if ((m.avulso ? !!m.nome : !!m.selectedId) && m.quantidade <= 0)
        errors.push(`Módulo ${i + 1}: quantidade`);
    });
    inversorEntries.forEach((inv, i) => {
      const isValid = inv.avulso ? !!inv.nome : !!inv.selectedId;
      if (isValid && inv.quantidade <= 0)
        errors.push(`Inversor ${i + 1}: quantidade`);
      if (isValid && inv.avulso) {
        if (!inv.fases) errors.push(`Inversor ${i + 1}: fases`);
        if (!inv.tensaoLinha || inv.tensaoLinha <= 0) errors.push(`Inversor ${i + 1}: tensão de linha`);
        if (!inv.potenciaW || inv.potenciaW <= 0) errors.push(`Inversor ${i + 1}: potência`);
      }
    });

    if (errors.length > 0) {
      toast({ title: "Campos obrigatórios", description: errors.join(", "), variant: "destructive" });
      return;
    }

    const itens: KitItemRow[] = [];

    moduloEntries.forEach(m => {
      if (m.avulso) {
        if (!m.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${m.fabricante} ${m.nome} ${m.potenciaW}W`,
          fabricante: m.fabricante, modelo: m.nome, potencia_w: m.potenciaW,
          quantidade: m.quantidade, preco_unitario: 0, categoria: "modulo", avulso: true,
        });
      } else {
        const cat = modulos.find(c => c.id === m.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || 0}W`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: cat.potencia_wp || 0,
          quantidade: m.quantidade, preco_unitario: 0, categoria: "modulo", avulso: false,
          produto_ref: cat.id,
        });
      }
    });

    inversorEntries.forEach(inv => {
      if (inv.avulso) {
        if (!inv.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${inv.fabricante} ${inv.nome} ${(inv.potenciaW / 1000).toFixed(1)}kW`,
          fabricante: inv.fabricante, modelo: inv.nome, potencia_w: inv.potenciaW,
          quantidade: inv.quantidade, preco_unitario: 0, categoria: "inversor", avulso: true,
        });
      } else {
        const cat = inversores.find(c => c.id === inv.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${(cat.potencia_nominal_kw || 0).toFixed(1)}kW`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: (cat.potencia_nominal_kw || 0) * 1000,
          quantidade: inv.quantidade, preco_unitario: 0, categoria: "inversor", avulso: false,
          produto_ref: cat.id,
        });
      }
    });

    // Otimizadores
    otimizadorEntries.forEach(ot => {
      if (ot.avulso) {
        if (!ot.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${ot.fabricante} ${ot.nome} ${ot.potenciaW}W`,
          fabricante: ot.fabricante, modelo: ot.nome, potencia_w: ot.potenciaW,
          quantidade: ot.quantidade, preco_unitario: 0, categoria: "outros", avulso: true,
        });
      } else {
        const cat = otimizadores.find(c => c.id === ot.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || 0}W`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: cat.potencia_wp || 0,
          quantidade: ot.quantidade, preco_unitario: 0, categoria: "outros", avulso: false,
        });
      }
    });

    // Baterias
    bateriaEntries.forEach(bat => {
      if (bat.avulso) {
        if (!bat.nome) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${bat.fabricante} ${bat.nome} ${bat.energiaKwh}kWh`,
          fabricante: bat.fabricante, modelo: bat.nome, potencia_w: bat.energiaKwh * 1000,
          quantidade: bat.quantidade, preco_unitario: 0, categoria: "bateria", avulso: true,
        });
      } else {
        const cat = baterias.find(c => c.id === bat.selectedId);
        if (!cat) return;
        itens.push({
          id: crypto.randomUUID(), descricao: `${cat.fabricante} ${cat.modelo} ${cat.energia_kwh || 0}kWh`,
          fabricante: cat.fabricante, modelo: cat.modelo, potencia_w: (cat.energia_kwh || 0) * 1000,
          quantidade: bat.quantidade, preco_unitario: 0, categoria: "bateria", avulso: false,
          produto_ref: cat.id,
        });
      }
    });

    componenteEntries.forEach(c => {
      if (!c.nome) return;
      itens.push({
        id: crypto.randomUUID(), descricao: c.nome,
        fabricante: "", modelo: c.nome, potencia_w: 0,
        quantidade: c.quantidade, preco_unitario: 0, categoria: "outros", avulso: true,
      });
    });

    if (itens.length === 0) {
      toast({ title: "Adicione pelo menos um item", variant: "destructive" });
      return;
    }

    if (custo <= 0) {
      toast({ title: "O custo do kit deve ser maior que zero", variant: "destructive" });
      return;
    }

    // Distribute custo proportionally by (quantidade * potencia_w) weight
    if (custo > 0) {
      const totalWeight = itens.reduce((s, i) => s + i.quantidade * Math.max(i.potencia_w, 1), 0);
      if (totalWeight > 0) {
        let distributed = 0;
        itens.forEach((item, idx) => {
          const weight = item.quantidade * Math.max(item.potencia_w, 1);
          if (idx < itens.length - 1) {
            item.preco_unitario = Math.round(((weight / totalWeight) * custo / item.quantidade) * 100) / 100;
            distributed += item.preco_unitario * item.quantidade;
          } else {
            // Last item gets the remainder to avoid rounding drift
            const remainder = custo - distributed;
            item.preco_unitario = Math.round((remainder / item.quantidade) * 100) / 100;
          }
        });
      } else {
        // Equal distribution with remainder correction
        const totalQty = itens.reduce((s, i) => s + i.quantidade, 0);
        const perItem = Math.floor((custo / totalQty) * 100) / 100;
        let distributed = 0;
        itens.forEach((item, idx) => {
          if (idx < itens.length - 1) {
            item.preco_unitario = perItem;
            distributed += perItem * item.quantidade;
          } else {
            item.preco_unitario = Math.round(((custo - distributed) / item.quantidade) * 100) / 100;
          }
        });
      }
    }

    const meta: KitMeta = {
      distribuidorNome, nomeKit, codigoKit, topologia, custo, sistema, custosEmbutidos,
    };
    onKitCreated(itens, meta);
    onOpenChange(false);
    toast({ title: "Kit criado manualmente", description: `${itens.length} itens adicionados` });
  };

  const title = mode === "equipamentos" ? "Criar kit manualmente" : "Criar kit manual do zero";

  // Inversor label based on topologia
  const inversorLabel = topologia === "Microinversor" ? "Microinversor" : "Inversor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Configure os componentes e custos do kit</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 sm:p-5 space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Nome do distribuidor <span className="text-destructive">*</span></Label>
              <Popover open={distribuidorOpen} onOpenChange={setDistribuidorOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      value={distribuidorNome}
                      onChange={e => { setDistribuidorNome(e.target.value); if (!distribuidorOpen) setDistribuidorOpen(true); }}
                      onFocus={() => setDistribuidorOpen(true)}
                      placeholder="Digite para buscar..."
                      className={cn("h-8 text-xs", triedSave && !distribuidorNome.trim() && "ring-2 ring-destructive")}
                      autoComplete="off"
                    />
                  </div>
                </PopoverTrigger>
                {fornecedoresFiltered.length > 0 && (
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" sideOffset={4} onOpenAutoFocus={e => e.preventDefault()}>
                    <div className="max-h-48 overflow-y-auto">
                      {fornecedoresFiltered.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer text-foreground"
                          onMouseDown={e => { e.preventDefault(); setDistribuidorNome(f.nome); setDistribuidorOpen(false); }}
                        >
                          {distribuidorNome.trim() ? highlightMatch(f.nome, distribuidorNome) : f.nome}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Custo <span className="text-destructive">*</span></Label>
              <CurrencyInput value={custo} onChange={setCusto} className={cn("h-8 text-xs", triedSave && custo <= 0 && "ring-2 ring-destructive")} placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Nome do Kit <span className="text-destructive">*</span></Label>
              <Input value={nomeKit} onChange={e => setNomeKit(e.target.value)} className={cn("h-8 text-xs", triedSave && !nomeKit.trim() && "ring-2 ring-destructive")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Código do Kit <span className="text-destructive">*</span></Label>
              <Input value={codigoKit} onChange={e => setCodigoKit(e.target.value)} className={cn("h-8 text-xs", triedSave && !codigoKit.trim() && "ring-2 ring-destructive")} />
            </div>
          </div>

          {/* Sistema */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Sistema</Label>
            <RadioGroup value={sistema} onValueChange={v => setSistema(v as any)} className="flex gap-4">
              {[{ v: "on_grid", l: "On grid" }, { v: "hibrido", l: "Híbrido" }, { v: "off_grid", l: "Off grid" }].map(o => (
                <div key={o.v} className="flex items-center gap-2">
                  <RadioGroupItem value={o.v} id={`s-${o.v}`} className="h-4 w-4" />
                  <Label htmlFor={`s-${o.v}`} className="text-xs cursor-pointer text-foreground">{o.l}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {mode === "equipamentos" && (
            <div className="space-y-1">
              <Label className="text-xs">Tipo do Kit *</Label>
              <RadioGroup value={tipoKit} onValueChange={v => setTipoKit(v as any)} className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="customizado" id="tk-c" className="h-3.5 w-3.5" />
                  <Label htmlFor="tk-c" className="text-xs cursor-pointer">Customizado</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="fechado" id="tk-f" className="h-3.5 w-3.5" />
                  <Label htmlFor="tk-f" className="text-xs cursor-pointer">Fechado</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Topologia + Custos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Topologia <span className="text-destructive">*</span></Label>
              <Select value={topologia} onValueChange={v => {
                setTopologia(v);
                // Auto-add otimizador entry when switching to Otimizador
                if (v === "Otimizador" && otimizadorEntries.length === 0) {
                  setOtimizadorEntries([createEmptyOtimizador()]);
                }
                // Clear otimizadores when switching away
                if (v !== "Otimizador") {
                  setOtimizadorEntries([]);
                }
                // Reset inversor selections since the filtered list changed
                setInversorEntries([createEmptyInversor()]);
              }}>
                <SelectTrigger className={cn("h-8 text-xs", triedSave && !topologia && "ring-2 ring-destructive")}><SelectValue placeholder="Selecione uma topologia" /></SelectTrigger>
                <SelectContent>
                  {TOPOLOGIAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "zero" && (
              <div className="space-y-1">
                <Label className="text-xs">Custos embutidos</Label>
                <div className="flex gap-4 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={custosEmbutidos.estruturas} onCheckedChange={v => setCustosEmbutidos(p => ({ ...p, estruturas: !!v }))} className="h-3.5 w-3.5" />
                    <Label className="text-xs cursor-pointer">Estruturas</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={custosEmbutidos.transformador} onCheckedChange={v => setCustosEmbutidos(p => ({ ...p, transformador: !!v }))} className="h-3.5 w-3.5" />
                    <Label className="text-xs cursor-pointer">Transformador</Label>
                  </div>
                </div>
              </div>
            )}
            {mode === "equipamentos" && (
              <div className="space-y-1">
                <Label className="text-xs">Distribuidor *</Label>
                <Select value={distribuidorSelect} onValueChange={setDistribuidorSelect}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o distribuidor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>


          {/* Itens */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Itens</Label>

            {/* Módulos */}
            {moduloEntries.map((m, idx) => (
              <div key={m.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
                      <SunMedium className="w-3.5 h-3.5 text-warning" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Módulo <span className="text-destructive">*</span></span>
                  </div>
                  {moduloEntries.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setModuloEntries(p => p.filter(x => x.id !== m.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {m.avulso ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nome do módulo *</Label>
                      <Input value={m.nome} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, nome: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd. *</Label>
                      <Input type="number" min="0" value={m.quantidade || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fabricante</Label>
                      <Input value={m.fabricante} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, fabricante: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Potência (W)</Label>
                      <Input type="number" min="0" value={m.potenciaW || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, potenciaW: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <SearchableEquipSelect
                      value={m.selectedId}
                      onValueChange={v => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, selectedId: v } : x))}
                      options={[...modulos]
                        .sort((a, b) => a.fabricante.localeCompare(b.fabricante) || (b.potencia_wp || 0) - (a.potencia_wp || 0))
                        .map(cat => ({
                          value: cat.id,
                          label: `${cat.fabricante} ${cat.modelo}${cat.potencia_wp ? ` (${cat.potencia_wp}W)` : ""}`,
                          searchText: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || ""}`,
                        }))}
                      placeholder="Buscar módulo..."
                      emptyText="Nenhum módulo encontrado"
                      className="flex-1"
                    />
                    <Input type="number" min="0" value={m.quantidade || ""} onChange={e => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs w-20" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={m.avulso} onCheckedChange={v => setModuloEntries(p => p.map(x => x.id === m.id ? { ...x, avulso: v } : x))} className="scale-75" />
                  <span className="text-[11px] text-muted-foreground">Avulso?</span>
                </div>
              </div>
            ))}

            {/* Inversores (filtered by topologia + sistema) */}
            {inversorEntries.map((inv, idx) => (
              <div key={inv.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Cable className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{inversorLabel} <span className="text-destructive">*</span></span>
                  </div>
                  {inversorEntries.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setInversorEntries(p => p.filter(x => x.id !== inv.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {inv.avulso ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Nome do {inversorLabel.toLowerCase()} *</Label>
                        <Input value={inv.nome} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, nome: e.target.value } : x))} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Qtd. *</Label>
                        <Input type="number" min="0" value={inv.quantidade || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Fabricante</Label>
                        <Input value={inv.fabricante} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, fabricante: e.target.value } : x))} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Potência (W) <span className="text-destructive">*</span></Label>
                        <Input type="number" min="0" value={inv.potenciaW || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, potenciaW: Math.max(0, Number(e.target.value) || 0) } : x))} className={cn("h-8 text-xs", triedSave && (!inv.potenciaW || inv.potenciaW <= 0) && "ring-2 ring-destructive")} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Fases do inversor <span className="text-destructive">*</span></Label>
                        <Select value={inv.fases} onValueChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, fases: v } : x))}>
                          <SelectTrigger className={cn("h-8 text-xs", triedSave && !inv.fases && "ring-2 ring-destructive")}><SelectValue placeholder="Selecione uma fase" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monofasico">Monofásico</SelectItem>
                            <SelectItem value="bifasico">Bifásico</SelectItem>
                            <SelectItem value="trifasico">Trifásico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Tensão de linha (V) <span className="text-destructive">*</span></Label>
                        <Input type="number" min="0" value={inv.tensaoLinha || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, tensaoLinha: Math.max(0, Number(e.target.value) || 0) } : x))} className={cn("h-8 text-xs", triedSave && (!inv.tensaoLinha || inv.tensaoLinha <= 0) && "ring-2 ring-destructive")} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <SearchableEquipSelect
                      value={inv.selectedId}
                      onValueChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, selectedId: v } : x))}
                      options={filteredInversores.length > 0 ? [...filteredInversores]
                        .sort((a, b) => a.fabricante.localeCompare(b.fabricante) || (b.potencia_nominal_kw || 0) - (a.potencia_nominal_kw || 0))
                        .map(cat => ({
                          value: cat.id,
                          label: `${cat.fabricante} ${cat.modelo} (${(cat.potencia_nominal_kw || 0).toFixed(1)}kW)${cat.tipo ? ` • ${cat.tipo}` : ""}`,
                          searchText: `${cat.fabricante} ${cat.modelo} ${(cat.potencia_nominal_kw || 0).toFixed(1)} ${cat.tipo || ""}`,
                        })) : []}
                      placeholder="Buscar inversor..."
                      emptyText="Nenhum inversor encontrado para esta topologia/sistema"
                      className="flex-1"
                    />
                    <Input type="number" min="0" value={inv.quantidade || ""} onChange={e => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs w-20" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={inv.avulso} onCheckedChange={v => setInversorEntries(p => p.map(x => x.id === inv.id ? { ...x, avulso: v } : x))} className="scale-75" />
                    <span className="text-[11px] text-muted-foreground">Avulso?</span>
                  </div>
                  {idx === inversorEntries.length - 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setInversorEntries(p => [...p, createEmptyInversor()])} className="text-xs text-primary font-medium h-7 hover:bg-primary/10">
                      + Adicionar mais
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Otimizadores (only when topologia = Otimizador) */}
            {showOtimizadores && otimizadorEntries.map((ot, idx) => (
              <div key={ot.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-info/10 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5 text-info" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Otimizador <span className="text-destructive">*</span></span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setOtimizadorEntries(p => p.filter(x => x.id !== ot.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {ot.avulso ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nome do otimizador *</Label>
                      <Input value={ot.nome} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, nome: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd. *</Label>
                      <Input type="number" min="0" value={ot.quantidade || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fabricante</Label>
                      <Input value={ot.fabricante} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, fabricante: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Potência (W)</Label>
                      <Input type="number" min="0" value={ot.potenciaW || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, potenciaW: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <SearchableEquipSelect
                      value={ot.selectedId}
                      onValueChange={v => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, selectedId: v } : x))}
                      options={otimizadores.map(cat => ({
                        value: cat.id,
                        label: `${cat.fabricante} ${cat.modelo} (${cat.potencia_wp || 0}W)`,
                        searchText: `${cat.fabricante} ${cat.modelo} ${cat.potencia_wp || ""}`,
                      }))}
                      placeholder="Buscar otimizador..."
                      emptyText="Nenhum otimizador cadastrado"
                      className="flex-1"
                    />
                    <Input type="number" min="0" value={ot.quantidade || ""} onChange={e => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs w-20" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={ot.avulso} onCheckedChange={v => setOtimizadorEntries(p => p.map(x => x.id === ot.id ? { ...x, avulso: v } : x))} className="scale-75" />
                    <span className="text-[11px] text-muted-foreground">Avulso?</span>
                  </div>
                  {idx === otimizadorEntries.length - 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setOtimizadorEntries(p => [...p, createEmptyOtimizador()])} className="text-xs text-primary font-medium h-7 hover:bg-primary/10">
                      + Adicionar mais
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Componentes extras (only in "zero" mode) */}
            {mode === "zero" && (
              <>
                {componenteEntries.map(c => (
                  <div key={c.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Boxes className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">Componente <span className="text-destructive">*</span></span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setComponenteEntries(p => p.filter(x => x.id !== c.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={c.nome} onChange={e => setComponenteEntries(p => p.map(x => x.id === c.id ? { ...x, nome: e.target.value } : x))} className="h-8 text-xs flex-1" placeholder="Nome do componente" />
                      <Input type="number" min="0" value={c.quantidade || ""} onChange={e => setComponenteEntries(p => p.map(x => x.id === c.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs w-20" placeholder="0" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setComponenteEntries(p => [...p, { id: crypto.randomUUID(), nome: "", quantidade: 0 }])} className="text-xs text-primary font-medium h-7 hover:bg-primary/10">
                      + Adicionar mais
                    </Button>
                  </div>
                ))}
              </>
            )}

            {/* Baterias */}
            {bateriaEntries.map((bat, idx) => (
              <div key={bat.id} className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center shrink-0">
                      <BatteryCharging className="w-3.5 h-3.5 text-success" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Bateria</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => setBateriaEntries(p => p.filter(x => x.id !== bat.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {bat.avulso ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nome da bateria *</Label>
                      <Input value={bat.nome} onChange={e => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, nome: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Qtd. *</Label>
                      <Input type="number" min="0" value={bat.quantidade || ""} onChange={e => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fabricante</Label>
                      <Input value={bat.fabricante} onChange={e => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, fabricante: e.target.value } : x))} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Energia (kWh)</Label>
                      <Input type="number" min="0" step="0.1" value={bat.energiaKwh || ""} onChange={e => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, energiaKwh: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <SearchableEquipSelect
                      value={bat.selectedId}
                      onValueChange={v => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, selectedId: v } : x))}
                      options={baterias.map(cat => ({
                        value: cat.id,
                        label: `${cat.fabricante} ${cat.modelo}${cat.energia_kwh ? ` (${cat.energia_kwh}kWh)` : ""}`,
                        searchText: `${cat.fabricante} ${cat.modelo} ${cat.energia_kwh || ""}`,
                      }))}
                      placeholder="Buscar bateria..."
                      emptyText="Nenhuma bateria cadastrada"
                      className="flex-1"
                    />
                    <Input type="number" min="0" value={bat.quantidade || ""} onChange={e => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, quantidade: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-8 text-xs w-20" placeholder="0" />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={bat.avulso} onCheckedChange={v => setBateriaEntries(p => p.map(x => x.id === bat.id ? { ...x, avulso: v } : x))} className="scale-75" />
                    <span className="text-[11px] text-muted-foreground">Avulso?</span>
                  </div>
                  {idx === bateriaEntries.length - 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setBateriaEntries(p => [...p, createEmptyBateria()])} className="text-xs text-primary font-medium h-7 hover:bg-primary/10">
                      + Adicionar mais
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Add buttons */}
            <div className="flex flex-wrap gap-2">
              {otimizadorEntries.length === 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 border-dashed text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5" onClick={() => setOtimizadorEntries(p => [...p, createEmptyOtimizador()])}>
                  <Plus className="w-3.5 h-3.5" /> Otimizador
                </Button>
              )}
              {bateriaEntries.length === 0 && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 border-dashed text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5" onClick={() => setBateriaEntries(p => [...p, createEmptyBateria()])}>
                  <Plus className="w-3.5 h-3.5" /> Bateria
                </Button>
              )}
              {mode === "zero" && (
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 border-dashed text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5" onClick={() => setComponenteEntries(p => [...p, { id: crypto.randomUUID(), nome: "", quantidade: 1 }])}>
                  <Plus className="w-3.5 h-3.5" /> Componente
                </Button>
              )}
            </div>
          </div>

        </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Potência: <span className="font-medium text-foreground">{formatKwp(potenciaTotal)}</span>
            </span>
            <Button onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
