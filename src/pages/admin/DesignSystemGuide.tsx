import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sun, 
  Leaf, 
  ShieldCheck, 
  Info, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  Palette, 
  Type, 
  Layers, 
  Smartphone,
  Moon
} from "lucide-react";

const ColorSwatch = ({ name, variable, description }: { name: string, variable: string, description: string }) => (
  <div className="flex flex-col gap-2">
    <div 
      className="h-20 w-full rounded-lg border shadow-sm transition-transform hover:scale-[1.02]" 
      style={{ backgroundColor: `hsl(var(${variable}))` }}
    />
    <div>
      <p className="text-sm font-semibold">{name}</p>
      <code className="text-xs text-muted-foreground">{variable}</code>
      <p className="text-xs mt-1 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const DesignSystemGuide = () => {
  return (
    <div className="container mx-auto py-10 space-y-12 animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Sun className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">LuminaSolar Design System</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Arquitetura de design canônica para o ecossistema Mais Energia Solar. 
          Foco em sofisticação, autoridade técnica e sustentabilidade (Nature Green).
        </p>
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-8">
          <TabsTrigger value="tokens" className="gap-2">
            <Palette className="w-4 h-4" /> Tokens
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-2">
            <Type className="w-4 h-4" /> Typography
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-2">
            <Layers className="w-4 h-4" /> Components
          </TabsTrigger>
          <TabsTrigger value="accessibility" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Acessibilidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-10">
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-semibold">Brand Identity (Solar Core)</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              <ColorSwatch 
                name="Solar Gold (New)" 
                variable="--solar-gold" 
                description="O novo padrão LuminaSolar para energia e vitalidade."
              />
              <ColorSwatch 
                name="Primary (Legacy)" 
                variable="--primary" 
                description="Atual Solar Orange (em transição)."
              />
              <ColorSwatch 
                name="Secondary (Authority)" 
                variable="--secondary" 
                description="Confiança técnica e solidez (Structural Blue)."
              />
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-success" />
              <h2 className="text-2xl font-semibold">Sustainability (Nature Green)</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              <ColorSwatch 
                name="Nature Green (New)" 
                variable="--nature-green" 
                description="O novo padrão LuminaSolar para sustentabilidade."
              />
              <ColorSwatch 
                name="Success (Legacy)" 
                variable="--success" 
                description="Sinalização de sucesso atual."
              />
              <ColorSwatch 
                name="Warning (Caution)" 
                variable="--warning" 
                description="Atenção e riscos operacionais."
              />
              <ColorSwatch 
                name="Destructive (Error)" 
                variable="--destructive" 
                description="Falhas críticas e exclusões."
              />
              <ColorSwatch 
                name="Info (System)" 
                variable="--info" 
                description="Informativos e guias."
              />
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-2xl font-semibold">Surfaces & Depth</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              <ColorSwatch 
                name="Background" 
                variable="--background" 
                description="Camada base da aplicação."
              />
              <ColorSwatch 
                name="Surface 1 (Card)" 
                variable="--surface-1" 
                description="Elevação primária."
              />
              <ColorSwatch 
                name="Surface 2 (Subtle)" 
                variable="--surface-2" 
                description="Contraste de seções."
              />
              <ColorSwatch 
                name="Surface 3 (Darker)" 
                variable="--surface-3" 
                description="Divisores e fundos profundos."
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="typography" className="space-y-10">
          <Card>
            <CardHeader>
              <CardTitle>Hierarchy & Fonts</CardTitle>
              <CardDescription>Plus Jakarta Sans para títulos, Inter para interface.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Display L (Plus Jakarta Sans)</span>
                <h1 className="text-5xl font-extrabold tracking-tight">The Future of Energy is Solar</h1>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Heading 1</span>
                <h1>Gestão Operacional de Alta Performance</h1>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Heading 2</span>
                <h2>Dashboard de Projetos Fotovoltaicos</h2>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Body Text (Inter)</span>
                <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                  Nossa plataforma conecta vendedores, engenheiros e instaladores em um único 
                  ecossistema atômico. A consistência financeira e operacional é garantida 
                  por tokens semânticos e governança de dados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Buttons (Actions)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button>Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="soft">Solar Soft</Button>
                <Button variant="success">Success Action</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges (Status)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Badge>Default</Badge>
                <Badge variant="secondary">Structural</Badge>
                <Badge variant="success">Finalizado</Badge>
                <Badge variant="warning">Pendente</Badge>
                <Badge variant="destructive">Atrasado</Badge>
                <Badge variant="soft">Soft Solar</Badge>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Forms & Feedback</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Input Standard</Label>
                    <Input placeholder="Ex: Nome do Projeto" />
                  </div>
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 flex gap-3 text-success">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">Operação atômica concluída com sucesso.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex gap-3 text-warning">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">Atenção: Projeto sem responsável técnico.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-3 text-destructive">
                    <XCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">Erro: Conexão com gateway financeiro perdida.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accessibility" className="space-y-10">
          <Card>
            <CardHeader>
              <CardTitle>Compliance WCAG AA</CardTitle>
              <CardDescription>Garantia de legibilidade e navegação inclusiva.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl border space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Smartphone className="w-5 h-5" />
                    <h3 className="font-semibold">Mobile First</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Áreas de toque mínimas de 44x44px em todos os botões mobile.</p>
                </div>
                <div className="p-6 rounded-xl border space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Moon className="w-5 h-5" />
                    <h3 className="font-semibold">Dark Mode</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Tokens automáticos para redução de fadiga ocular em ambientes escuros.</p>
                </div>
                <div className="p-6 rounded-xl border space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Info className="w-5 h-5" />
                    <h3 className="font-semibold">Arias & Roles</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Uso semântico de HTML5 para leitores de tela e tecnologias assistivas.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DesignSystemGuide;