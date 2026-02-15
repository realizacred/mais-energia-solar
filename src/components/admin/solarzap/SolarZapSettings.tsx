import { useState } from "react";
import {
  Users, Bot, Plus, Trash2, GripVertical,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

// Demo operators
const OPERATORS = [
  { id: "1", nome: "Carlos Silva", email: "carlos@empresa.com", ativo: true, departamentos: ["Vendas"], token: "tok_abc***xyz" },
  { id: "2", nome: "Ana Souza", email: "ana@empresa.com", ativo: true, departamentos: ["Vendas", "Engenharia"], token: "tok_def***uvw" },
  { id: "3", nome: "Pedro Santos", email: "pedro@empresa.com", ativo: false, departamentos: ["Engenharia"], token: "tok_ghi***rst" },
  { id: "4", nome: "Maria Oliveira", email: "maria@empresa.com", ativo: true, departamentos: ["Financeiro"], token: "tok_jkl***opq" },
];

const DEPT_COLORS: Record<string, string> = {
  Vendas: "bg-primary/10 text-primary border-primary/30",
  Engenharia: "bg-info/10 text-info border-info/30",
  Financeiro: "bg-success/10 text-success border-success/30",
};

export function SolarZapSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Configurações SolarZap</h2>
        <p className="text-sm text-muted-foreground">Gerencie operadores e automações do atendimento</p>
      </div>

      <Tabs defaultValue="operadores" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="operadores" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Operadores
          </TabsTrigger>
          <TabsTrigger value="automacao" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Automação (Bot)
          </TabsTrigger>
        </TabsList>

        {/* Operadores Tab */}
        <TabsContent value="operadores" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Equipe de Atendimento</CardTitle>
                  <CardDescription className="text-xs">Gerencie os membros com acesso ao SolarZap</CardDescription>
                </div>
                <Button size="sm" className="h-8 text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Departamentos</TableHead>
                    <TableHead>Token</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {OPERATORS.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-muted">
                              {op.nome.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{op.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{op.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={op.ativo} />
                          <span className={`text-xs ${op.ativo ? "text-success" : "text-muted-foreground"}`}>
                            {op.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {op.departamentos.map((d) => (
                            <Badge key={d} variant="outline" className={`text-[10px] px-1.5 ${DEPT_COLORS[d] || ""}`}>
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                          {op.token}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automação Tab */}
        <TabsContent value="automacao" className="mt-4 space-y-4">
          <BotWelcomeCard />
          <BotMenuCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BotWelcomeCard() {
  const [msg, setMsg] = useState(
    "Olá! 👋 Bem-vindo à Mais Energia Solar! ☀️\nEstamos prontos para te ajudar a economizar na conta de luz.\nDigite uma opção abaixo para iniciar:"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Mensagem de Boas-vindas</CardTitle>
        <CardDescription className="text-xs">
          Enviada automaticamente quando o cliente inicia uma conversa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          className="w-full h-28 text-sm rounded-lg border border-input bg-background px-3 py-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 resize-none"
          placeholder="Digite a mensagem de boas-vindas..."
        />
      </CardContent>
    </Card>
  );
}

function BotMenuCard() {
  const [options, setOptions] = useState([
    { id: "1", key: "1", label: "Solicitar orçamento" },
    { id: "2", key: "2", label: "Falar com consultor" },
    { id: "3", key: "3", label: "Status do meu projeto" },
    { id: "4", key: "4", label: "Financeiro" },
  ]);

  const addOption = () => {
    const nextKey = String(options.length + 1);
    setOptions([...options, { id: crypto.randomUUID(), key: nextKey, label: "" }]);
  };

  const removeOption = (id: string) => {
    setOptions(options.filter((o) => o.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    setOptions(options.map((o) => (o.id === id ? { ...o, label } : o)));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Menu de Opções</CardTitle>
            <CardDescription className="text-xs">
              Opções numéricas que o cliente pode digitar
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={addOption}>
            <Plus className="h-3.5 w-3.5" />
            Opção
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
              <div className="flex items-center gap-0 shrink-0">
                <span className="text-xs font-mono text-muted-foreground bg-muted/60 rounded-l-md border border-r-0 border-input px-2 py-1.5 h-9 flex items-center">
                  {opt.key}
                </span>
              </div>
              <Input
                value={opt.label}
                onChange={(e) => updateLabel(opt.id, e.target.value)}
                placeholder="Descrição da opção..."
                className="h-9 text-sm flex-1 rounded-l-none"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 text-destructive/60 hover:text-destructive"
                onClick={() => removeOption(opt.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Separator className="my-3 bg-border/30" />

        {/* Preview */}
        <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Preview do Menu
          </p>
          <div className="bg-muted rounded-xl p-2.5 text-xs leading-relaxed">
            {options.filter((o) => o.label).map((o) => (
              <p key={o.id}>
                <span className="font-mono font-bold">{o.key}</span> → {o.label}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
