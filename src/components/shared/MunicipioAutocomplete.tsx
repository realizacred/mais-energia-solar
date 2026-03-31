/**
 * MunicipioAutocomplete — Autocomplete de município com persistência do código IBGE
 *
 * O usuário busca por cidade; o sistema salva o codigo_ibge por trás.
 * Não exibe o código IBGE como foco da UX.
 *
 * §13: Componente reutilizável obrigatório
 * RB-01: Cores semânticas
 * RB-02: Dark mode
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchMunicipios, useMunicipioByCodigo, type MunicipioIBGE } from "@/hooks/useMunicipiosIBGE";

interface MunicipioAutocompleteProps {
  /** Código IBGE selecionado */
  value: string | null | undefined;
  /** Callback ao selecionar município — retorna codigo_ibge, cidade, UF */
  onChange: (codigoIbge: string | null, cidade: string, uf: string) => void;
  /** Filtrar por UF (opcional) */
  uf?: string;
  /** Label do campo */
  label?: string;
  /** Campo obrigatório */
  required?: boolean;
  /** Desabilitado */
  disabled?: boolean;
  /** Placeholder */
  placeholder?: string;
  /** Classes extras */
  className?: string;
}

export function MunicipioAutocomplete({
  value,
  onChange,
  uf,
  label = "Município",
  required = false,
  disabled = false,
  placeholder = "Digite o nome da cidade...",
  className,
}: MunicipioAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Busca por termo
  const { data: results = [], isLoading } = useSearchMunicipios(searchTerm, uf);

  // Resolver label do valor atual
  const { data: currentMunicipio } = useMunicipioByCodigo(value);

  // Sincronizar label quando valor muda externamente
  useEffect(() => {
    if (currentMunicipio) {
      setSelectedLabel(`${currentMunicipio.nome} - ${currentMunicipio.uf_sigla}`);
    } else if (!value) {
      setSelectedLabel("");
    }
  }, [currentMunicipio, value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (value && selectedLabel) {
          setSearchTerm("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, selectedLabel]);

  const handleSelect = useCallback(
    (municipio: MunicipioIBGE) => {
      setSelectedLabel(`${municipio.nome} - ${municipio.uf_sigla}`);
      setSearchTerm("");
      setIsOpen(false);
      onChange(municipio.codigo_ibge, municipio.nome, municipio.uf_sigla);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setSelectedLabel("");
    setSearchTerm("");
    onChange(null, "", "");
  }, [onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchTerm(val);
      setIsOpen(val.length >= 2);
      if (value && val !== selectedLabel) {
        // User is typing over a selected value
        setSelectedLabel("");
        onChange(null, "", "");
      }
    },
    [value, selectedLabel, onChange]
  );

  const displayValue = selectedLabel || searchTerm;

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (searchTerm.length >= 2) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-9 pr-8", value && "border-success/50")}
        />

        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && value && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!isLoading && !value && selectedLabel && (
          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {results.map((m) => (
            <button
              key={m.codigo_ibge}
              type="button"
              onClick={() => handleSelect(m)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                "flex items-center justify-between gap-2",
                value === m.codigo_ibge && "bg-primary/5"
              )}
            >
              <span className="text-foreground truncate">
                {m.nome}
                <span className="text-muted-foreground ml-1">- {m.uf_sigla}</span>
              </span>
              {m.regiao && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {m.regiao}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-card shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum município encontrado
          </p>
        </div>
      )}
    </div>
  );
}
