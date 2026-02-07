import SunIcon from "@/components/SunIcon";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: "var(--gradient-hero)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-up">
        <SunIcon className="w-24 h-24 animate-sun-pulse" />

        <div className="text-center space-y-3">
          <h1 className="text-5xl md:text-6xl font-extrabold font-heading tracking-tight text-foreground">
            Mais{" "}
            <span className="text-primary">Energia</span>{" "}
            <span className="text-secondary">Solar</span>
          </h1>
          <p className="text-lg text-muted-foreground font-body max-w-md mx-auto">
            Energia limpa e renovável para o seu futuro.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
