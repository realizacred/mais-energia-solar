import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  MapPin,
  User,
  Clock,
  Eye,
  Grid3X3,
  Image,
  Video,
  Volume2,
  CheckCircle2,
  ClipboardCheck,
  MoreVertical,
  Calendar,
} from "lucide-react";
import { Servico, Instalador, tipoOptions, statusConfig } from "./types";

interface ServicosTableProps {
  servicos: Servico[];
  instaladores: Instalador[];
  onViewDetails: (id: string) => void;
  onOpenLayoutEditor: (servico: Servico) => void;
  onValidar: (servico: Servico) => void;
  onReagendar: (servico: Servico) => void;
}

export function ServicosTable({
  servicos,
  instaladores,
  onViewDetails,
  onOpenLayoutEditor,
  onValidar,
  onReagendar,
}: ServicosTableProps) {
  const getInstaladorNome = (id: string) => {
    return instaladores.find((i) => i.id === id)?.nome || "—";
  };

  const isAtrasado = (servico: Servico) => {
    const dataAgendada = new Date(servico.data_agendada);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return servico.status === "agendado" && dataAgendada < hoje;
  };

  if (servicos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum serviço encontrado com os filtros aplicados
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Instalador</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Validado</TableHead>
          <TableHead>Mídia</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servicos.map((servico) => (
          <TableRow key={servico.id} className={isAtrasado(servico) ? "bg-red-50 dark:bg-red-950/20" : ""}>
            <TableCell>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {format(parseISO(servico.data_agendada), "dd/MM/yy", { locale: ptBR })}
                {isAtrasado(servico) && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1">
                    Atrasado
                  </Badge>
                )}
              </div>
              {servico.hora_inicio && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {servico.hora_inicio.slice(0, 5)}
                </div>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {tipoOptions.find((t) => t.value === servico.tipo)?.label}
              </Badge>
            </TableCell>
            <TableCell>
              {servico.cliente ? (
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {servico.cliente.nome}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{getInstaladorNome(servico.instalador_id)}</TableCell>
            <TableCell>
              {servico.cidade || servico.bairro ? (
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {[servico.bairro, servico.cidade].filter(Boolean).join(", ")}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={statusConfig[servico.status]?.variant || "default"}>
                {statusConfig[servico.status]?.label || servico.status}
              </Badge>
            </TableCell>
            <TableCell>
              {servico.status === "concluido" ? (
                servico.validado ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Sim
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onValidar(servico)}
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    Validar
                  </Button>
                )
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {servico.fotos_urls && servico.fotos_urls.length > 0 && (
                  <div className="flex items-center gap-0.5 text-muted-foreground" title={`${servico.fotos_urls.length} fotos`}>
                    <Image className="h-3.5 w-3.5" />
                    <span className="text-xs">{servico.fotos_urls.length}</span>
                  </div>
                )}
                {servico.video_url && (
                  <span title="Vídeo">
                    <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
                {servico.audio_url && (
                  <span title="Áudio">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
                {servico.layout_modulos && (
                  <span title="Layout">
                    <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewDetails(servico.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenLayoutEditor(servico)}>
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Editor de Layout
                  </DropdownMenuItem>
                  {servico.status === "agendado" && (
                    <DropdownMenuItem onClick={() => onReagendar(servico)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Reagendar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
