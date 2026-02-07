import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  RefreshCw, 
  Loader2, 
  Trash2, 
  CloudUpload, 
  WifiOff, 
  ChevronDown, 
  ChevronUp,
  FileText,
  User,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useOfflineConversionSync, OfflineConversion } from "@/hooks/useOfflineConversionSync";

export function OfflineConversionsManager() {
  const {
    isOnline,
    pendingConversions,
    isSyncing,
    syncingId,
    syncSingleConversion,
    syncAllConversions,
    removeConversion,
  } = useOfflineConversionSync();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (pendingConversions.length === 0) {
    return null;
  }

  const toggleExpanded = (leadId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(leadId)) {
      newExpanded.delete(leadId);
    } else {
      newExpanded.add(leadId);
    }
    setExpandedItems(newExpanded);
  };

  const getDocumentCount = (conversion: OfflineConversion) => {
    return (
      conversion.identidadeFiles.length +
      conversion.comprovanteFiles.length +
      conversion.beneficiariaFiles.length
    );
  };

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-warning" />
            <CardTitle className="text-lg">Conversões Offline Pendentes</CardTitle>
            <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
              {pendingConversions.length}
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={() => syncAllConversions()}
            disabled={!isOnline || isSyncing}
            className="gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                Sincronizar Todas
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          {isOnline 
            ? "Você está online. Clique para enviar as conversões pendentes."
            : "Você está offline. As conversões serão enviadas quando a conexão voltar."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingConversions.map((conversion) => (
          <Collapsible
            key={conversion.leadId}
            open={expandedItems.has(conversion.leadId)}
            onOpenChange={() => toggleExpanded(conversion.leadId)}
          >
            <div className="border rounded-lg bg-background">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{conversion.leadNome}</p>
                      <p className="text-xs text-muted-foreground">
                        Salvo em {format(new Date(conversion.savedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <FileText className="w-3 h-3 mr-1" />
                      {getDocumentCount(conversion)} doc(s)
                    </Badge>
                    {expandedItems.has(conversion.leadId) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3 border-t pt-3">
                  {/* Lead Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {conversion.formData.cidade}, {conversion.formData.estado}
                    </div>
                    <div className="text-muted-foreground">
                      Tel: {conversion.formData.telefone}
                    </div>
                  </div>

                  {/* Documents summary */}
                  <div className="flex flex-wrap gap-2">
                    {conversion.identidadeFiles.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Identidade ({conversion.identidadeFiles.length})
                      </Badge>
                    )}
                    {conversion.comprovanteFiles.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Comprovante ({conversion.comprovanteFiles.length})
                      </Badge>
                    )}
                    {conversion.beneficiariaFiles.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Beneficiária ({conversion.beneficiariaFiles.length})
                      </Badge>
                    )}
                    {conversion.formData.disjuntor_id && (
                      <Badge variant="outline" className="text-xs">
                        Disjuntor ✓
                      </Badge>
                    )}
                    {conversion.formData.transformador_id && (
                      <Badge variant="outline" className="text-xs">
                        Transformador ✓
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => syncSingleConversion(conversion.leadId)}
                      disabled={!isOnline || syncingId === conversion.leadId}
                      className="gap-2 flex-1"
                    >
                      {syncingId === conversion.leadId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Sincronizar
                        </>
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-2">
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover conversão pendente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá remover a conversão de "{conversion.leadNome}" da fila offline.
                            Os dados salvos localmente serão perdidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeConversion(conversion.leadId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
