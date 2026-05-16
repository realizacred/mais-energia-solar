import React, { useState } from "react";
import { Book, AlertTriangle, Search, Terminal, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PLAYBOOKS, type Playbook } from "./playbookData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PlaybooksPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = PLAYBOOKS.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.symptoms.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast.success("SQL copiado!");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6 text-primary" />
            Playbooks Operacionais
          </h1>
          <p className="text-muted-foreground">Guias de diagnóstico e resolução de incidentes</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar sintoma ou título..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className={cn(
            "overflow-hidden transition-all",
            selectedId === p.id ? "ring-2 ring-primary/20" : "hover:border-primary/30"
          )}>
            <div 
              className="p-4 cursor-pointer flex items-center justify-between bg-muted/30"
              onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
            >
              <div className="flex items-center gap-3">
                <Badge variant={p.severity === "critical" ? "destructive" : p.severity === "warning" ? "warning" : "outline"}>
                  {p.severity.toUpperCase()}
                </Badge>
                <h3 className="font-semibold">{p.title}</h3>
              </div>
              {selectedId === p.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>

            {selectedId === p.id && (
              <CardContent className="p-6 space-y-6 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Sintomas
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        {p.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </section>
                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-info" />
                        Causas Prováveis
                      </h4>
                      <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        {p.causes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </section>
                  </div>

                  <div className="space-y-4">
                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <Terminal className="h-4 w-4 text-primary" />
                        Diagnóstico
                      </h4>
                      <ul className="list-decimal list-inside text-sm space-y-1 text-muted-foreground mb-3">
                        {p.diagnosis.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                      {p.diagnosis.sql && (
                        <div className="relative group">
                          <pre className="bg-slate-950 text-slate-50 p-3 rounded text-xs font-mono overflow-x-auto">
                            {p.diagnosis.sql}
                          </pre>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="absolute top-1 right-1 h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700"
                            onClick={() => copySql(p.diagnosis.sql!)}
                          >
                            Copiar SQL
                          </Button>
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section>
                    <h4 className="text-sm font-bold mb-2">Resolução</h4>
                    <ul className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                      {p.resolution.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </section>
                  <section className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="text-sm font-bold mb-1">Escalação</h4>
                    <p className="text-sm text-muted-foreground mb-3">{p.escalation}</p>
                    <h4 className="text-sm font-bold mb-1">Risco Operacional</h4>
                    <p className="text-sm text-destructive">{p.operational_risk}</p>
                  </section>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
            Nenhum playbook encontrado para "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
