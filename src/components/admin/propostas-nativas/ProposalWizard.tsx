
  const ClientContextPanel = useMemo(() => {
    if (!selectedLead) return null;
    const geracao = selectedLead.geracao_estimada_kwh;
    const consumo = selectedLead.media_consumo;
    const telhado = selectedLead.tipo_telhado;
    const fase = selectedLead.rede_atendimento;
    const cidade = selectedLead.cidade;
    const uf = selectedLead.estado;
    const obsLead = selectedLead.observacoes;
    const obsOrc = selectedLead.orc_observacoes;
    const source = selectedLead.source_type || "lead";

    return (
      <div className="bg-card border-b border-border shadow-sm sticky top-0 z-20 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold py-0 h-5">
                {source === "orcamento" ? "Orçamento" : "Lead"}
              </Badge>
              <span className="text-sm font-bold truncate max-w-[180px]">{selectedLead.nome}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {consumo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5 font-medium">
                        <Zap className="h-3 w-3" /> {consumo} kWh
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Consumo atual informado</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {geracao && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5 font-medium bg-blue-50 text-blue-700 border-blue-100">
                          <SunMedium className="h-3 w-3" /> {geracao} kWh/mês
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-0.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          onClick={() => {
                            if (!ucs.length) return;
                            handleUCsChange(prev => {
                              const updated = [...prev];
                              updated[0] = { ...updated[0], consumo_mensal: geracao };
                              return updated;
                            });
                            toast({ title: "Geração aplicada", description: `A UC geradora foi ajustada para ${geracao} kWh.` });
                          }}
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Geração desejada. Clique em repetir para usar na UC.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {telhado && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <LayoutGrid className="h-3 w-3" /> {telhado}
                </Badge>
              )}

              {fase && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <Zap className="h-3 w-3" /> {fase}
                </Badge>
              )}

              {(cidade || uf) && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <MapPin className="h-3 w-3" /> {cidade}{uf ? `/${uf}` : ""}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(obsLead || obsOrc) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span className="text-[11px] truncate max-w-[200px] lg:max-w-[400px]">
                        {obsOrc || obsLead}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 py-1">
                      {obsLead && (
                        <div>
                          <p className="font-bold text-[10px] uppercase text-primary">Obs. Lead</p>
                          <p className="text-xs">{obsLead}</p>
                        </div>
                      )}
                      {obsOrc && (
                        <div>
                          <p className="font-bold text-[10px] uppercase text-primary">Obs. Orçamento</p>
                          <p className="text-xs">{obsOrc}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedLead, ucs, handleUCsChange]);

  const applyPersistResult = useCallback((res: AtomicPersistResult) => {
    if (res.status === "error" || res.status === "blocked") return;
    
    // RB-SSOT: Hydrate identity immediately after success
    if (res.propostaId) setSavedPropostaId(res.propostaId);
    if (res.versaoId) setSavedVersaoId(res.versaoId);
    if (res.projetoId) setSavedProjetoId(res.projetoId);
    if (res.dealId) setSavedDealId(res.dealId);
    if (res.clienteId) setSavedClienteId(res.clienteId);
    
    // Inject identity into context immediately so StepDocumento can resolve links/preview
    if (res.propostaId && res.versaoId) {
      setResult((prev: any) => ({
        ...prev,
        proposta_id: res.propostaId,
        versao_id: res.versaoId,
        projeto_id: res.projetoId,
      }));
    }

    setHasEditsAfterRestore(false); // Reset draft flag after successful save
  }, []);

  // ─── Fire-and-forget: sync template_id_used on proposta_versoes (RB-25)
  const syncTemplateIdUsed = useCallback((versaoId: string | undefined | null) => {
    if (!versaoId || !templateSelecionado) return;
    const selectedTpl = proposalTemplates.find(t => t.id === templateSelecionado);
    if (!selectedTpl || selectedTpl.tipo !== "html") return;
    supabase
      .from("proposta_versoes")
      .update({ template_id_used: templateSelecionado } as any)
      .eq("id", versaoId)
      .then(({ error }) => {
        if (error) console.error("[ProposalWizard] template_id_used sync error:", error.message);
      });
  }, [templateSelecionado, proposalTemplates]);
  // ─── Fire-and-forget: persist custom field values to deal_custom_field_values (RB-25)
  const syncCustomFieldValues = useCallback((dealId: string | undefined | null) => {
    if (!dealId || Object.keys(customFieldValues).length === 0) return;
    saveCustomFieldsMutation.mutate(
      { dealId, values: customFieldValues },
      { onError: (err) => console.error("[ProposalWizard] Custom fields save error:", err) },
    );
  }, [customFieldValues, saveCustomFieldsMutation]);

  const handleSaveDraft = useCallback(async () => {
    if (isRestoring) {
      toast({ title: "Aguarde", description: "Carregando dados da proposta..." });
      return;
    }
    if (dealIdFromUrl && !resolvedDealId) {
      toast({ title: "Erro", description: "deal_id obrigatório ao salvar proposta dentro de projeto.", variant: "destructive" });
      return;
    }
    const effectivePropostaId = savedPropostaId || propostaIdFromUrl || null;
    const effectiveVersaoId = savedVersaoId || versaoIdFromUrl || null;
    if (!savedPropostaId && effectivePropostaId) setSavedPropostaId(effectivePropostaId);
    if (!savedVersaoId && effectiveVersaoId) setSavedVersaoId(effectiveVersaoId);

    const params = buildPersistParams(effectivePropostaId, effectiveVersaoId);
    const res = await persistAtomic(params, "draft");

    switch (res.status) {
      case "success":
        applyPersistResult(res);
        syncCustomFieldValues(res.dealId || resolvedDealId);
        syncTemplateIdUsed(res.versaoId);
        invalidateProposalCaches(res.dealId || resolvedDealId, res.projetoId);
        toast({ 
          title: "✅ Rascunho salvo",
          description: "O valor oficial do projeto no CRM não foi alterado.",
          action: (
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-7 text-[10px] gap-1 px-2">
              <RefreshCw className="h-3 w-3" /> Atualizar telas
            </Button>
          )
        });
        break;
      case "reused":
        applyPersistResult(res);
        syncTemplateIdUsed(res.versaoId);
        invalidateProposalCaches(res.dealId || resolvedDealId, res.projetoId);
        break;
      case "blocked":
        toast({ title: "Aguarde", description: res.message, variant: "destructive" });
        break;
      case "error":
        console.error("[ProposalWizard] Draft save error:", res.reason, res.message);
        toast({ title: "Erro ao salvar", description: res.reason || res.message, variant: "destructive" });
        break;
    }
  }, [isRestoring, savedPropostaId, savedVersaoId, propostaIdFromUrl, versaoIdFromUrl, buildPersistParams, persistAtomic, applyPersistResult, dealIdFromUrl, resolvedDealId, syncCustomFieldValues, syncTemplateIdUsed, invalidateProposalCaches]);

  const handleUpdate = useCallback(async (setActive: boolean) => {
    // Sync state if using URL fallback (moved before interceptor)
    const effectivePropostaId = savedPropostaId || propostaIdFromUrl || null;
    const effectiveVersaoId = savedVersaoId || versaoIdFromUrl || null;
    if (!savedPropostaId && effectivePropostaId) setSavedPropostaId(effectivePropostaId);
    if (!savedVersaoId && effectiveVersaoId) setSavedVersaoId(effectiveVersaoId);

    // UX-03: Intercept update if proposal was already sent to client
    if (editingsentProposal && !showNewVersionConfirm) {
      setPendingUpdateAction(setActive);
      setShowNewVersionConfirm(true);
      return;
    }

    if (isRestoring) {
      toast({ title: "Aguarde", description: "A proposta ainda está sendo restaurada." });
      return;
    }

    const params = buildPersistParams(effectivePropostaId, effectiveVersaoId);
    const intent = setActive ? "active" as const : "draft" as const;
    const res = await persistAtomic(params, intent);

    switch (res.status) {
      case "success":
      case "reused":
        applyPersistResult(res);
        syncCustomFieldValues(res.dealId || resolvedDealId);
        syncTemplateIdUsed(res.versaoId);
        invalidateProposalCaches(res.dealId || resolvedDealId, res.projetoId);
        if (res.newVersionCreated) {
          toast({ title: "Nova versão criada", description: res.message });
        } else if (res.status !== "reused") {
          toast({ 
            title: setActive ? "✅ Proposta ativada!" : "✅ Rascunho salvo!",
            description: setActive ? "O valor oficial do projeto no CRM foi atualizado." : "O valor oficial no CRM não foi alterado.",
            action: (
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-7 text-[10px] gap-1 px-2">
                <RefreshCw className="h-3 w-3" /> Atualizar telas
              </Button>
            )
          });
        }
        break;
      case "blocked":
        toast({ title: "Aguarde", description: res.message, variant: "destructive" });
        break;
      case "error":
        console.error("[ProposalWizard] Update error:", res.reason, res.message);
        toast({ title: "Erro ao salvar", description: res.reason || res.message, variant: "destructive" });
        break;
    }
  }, [isRestoring, savedPropostaId, savedVersaoId, propostaIdFromUrl, versaoIdFromUrl, buildPersistParams, persistAtomic, applyPersistResult, syncCustomFieldValues, syncTemplateIdUsed, resolvedDealId, invalidateProposalCaches]);

  // ─── Grupo consistency validation
  const grupoValidation = useMemo(() => validateGrupoConsistency(ucs), [ucs]);
  const isGrupoMixed = !grupoValidation.valid && grupoValidation.error === "mixed_grupos";
  const isGrupoUndefined = !grupoValidation.valid && grupoValidation.error === "grupo_indefinido";

  // ─── Enforcement: resolver context
  // Derive precisao from UC tariff data already in state
  const precisaoFrontend = useMemo((): 'exato' | 'estimado' => {
    const uc = ucs[0];
    if (!uc) return 'estimado';
    if (uc.tarifa_fio_b && uc.tarifa_fio_b > 0) return 'exato';
    if (uc.tarifa_distribuidora && uc.tarifa_distribuidora > 0) return 'estimado';
    return 'estimado';
  }, [ucs]);

  const { settings: brandSettings } = useBrandSettings();
  const empresaLogoUrl = brandSettings?.logo_url || undefined;

  const resolverContext = useMemo<ProposalResolverContext>(() => ({
    cliente: {
      nome: cliente.nome || selectedLead?.nome,
      empresa: cliente.empresa,
      cnpj_cpf: cliente.cnpj_cpf,
      email: cliente.email,
      celular: cliente.celular,
      cep: cliente.cep,
      endereco: cliente.endereco,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      cidade: cliente.cidade || locCidade,
      estado: cliente.estado || locEstado,
    },
    ucs,
    premissas,
    potenciaKwp,
    geracaoMensal: geracaoMensalEstimada > 0 ? geracaoMensalEstimada : undefined,
    precoTotal: precoFinal ?? 0,
    consultorNome: undefined, // filled by backend
    empresaLogo: empresaLogoUrl,
    tariffVersion: {
      precisao: precisaoFrontend,
      te_kwh: 0,
      tusd_total_kwh: 0,
      fio_b_real_kwh: null,
      origem: 'frontend_uc',
    } satisfies TariffVersionContext,
  }), [cliente, selectedLead, ucs, premissas, potenciaKwp, geracaoMensalEstimada, precoFinal, locCidade, locEstado, precisaoFrontend, empresaLogoUrl]);

  const enforcement = useProposalEnforcement(resolverContext);

  // Feed resolved proposal variables to DevTools panel
  const { setActiveProposalVars, enabled: devEnabled } = useDevToolsContext();
  useEffect(() => {
    if (devEnabled && enforcement.resolverResult?.variables) {
      setActiveProposalVars(enforcement.resolverResult.variables);
    }
  }, [devEnabled, enforcement.resolverResult?.variables, setActiveProposalVars]);

  // (geracaoMensalEstimada moved before save callbacks)

  // Estimated area (m²) from module items — ~2m² per module panel
  const areaUtilEstimada = useMemo(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    const totalPaineis = modulosNoKit.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    return totalPaineis > 0 ? Math.round(totalPaineis * 2) : 0;
  }, [itens]);

  // Auto-sync potenciaKwp from kit items (modules) when items change
  useEffect(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    if (modulosNoKit.length === 0) return;
    const potenciaFromKit = modulosNoKit.reduce(
      (s, m) => s + ((m.potencia_w || 0) * (m.quantidade || 1)) / 1000, 0
    );
    if (potenciaFromKit > 0 && Math.abs(potenciaFromKit - potenciaKwp) > 0.01) {
      setPotenciaKwp(potenciaFromKit);
    }
  }, [itens]);

  // ─── Data fetching (extracted hooks)
  useSolarBrainSync(setPremissas, setPreDimensionamento, !!(propostaIdFromUrl && versaoIdFromUrl));
  // tenantTarifas + tariff sync + handleUcsChange moved to WizardContext (Fase C)

  // ─── Set project context from URL (even without customer_id)
  useEffect(() => {
    if (dealIdFromUrl) {
      setProjectContext({ dealId: dealIdFromUrl, customerId: customerIdFromUrl || "" });
    }
  }, [dealIdFromUrl, customerIdFromUrl]);

  // ─── Auto-load from project context (customer data)
  useEffect(() => {
    if (!customerIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth — skip customer auto-load
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email, cpf_cnpj, data_nascimento, empresa, cep, rua, numero, complemento, bairro, cidade, estado, lead_id, municipio_ibge_codigo")
          .eq("id", customerIdFromUrl)
          .maybeSingle();
        if (cancelled || !cli) return;

        setCliente({
          nome: cli.nome || "", empresa: cli.empresa || "", cnpj_cpf: cli.cpf_cnpj || "",
          email: cli.email || "", celular: cli.telefone || "",
          data_nascimento: (cli as any).data_nascimento || "",
          cep: cli.cep || "", endereco: cli.rua || "", numero: cli.numero || "",
          complemento: cli.complemento || "", bairro: cli.bairro || "",
          cidade: cli.cidade || "", estado: cli.estado || "",
        });

        // Populate project address fields from customer data
        setProjectAddress(prev => ({
          ...prev,
          cep: cli.cep || prev.cep,
          rua: cli.rua || prev.rua,
          numero: cli.numero || prev.numero,
          complemento: cli.complemento || prev.complemento,
          bairro: cli.bairro || prev.bairro,
          cidade: cli.cidade || prev.cidade,
          uf: cli.estado || prev.uf,
        }));

        if (cli.estado) setLocEstado(cli.estado);
        if (cli.cidade) setLocCidade(cli.cidade);
        if (cli.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(cli.municipio_ibge_codigo);

        if (cli.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, municipio_ibge_codigo")
            .eq("id", cli.lead_id)
            .maybeSingle();
          if (!cancelled && lead) {
            const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              geracao_estimada_kwh: lead.consumo_previsto || undefined,
              tipo_telhado: lead.tipo_telhado,
              municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
            });
            if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
            if (mappedTelhado) setLocTipoTelhado(mappedTelhado);
            if (lead.estado || lead.media_consumo) {
              setUcs(prev => {
                const updated = [...prev];
                updated[0] = {
                  ...updated[0],
                  estado: lead.estado || updated[0].estado,
                  cidade: lead.cidade || updated[0].cidade,
                  tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
                  consumo_mensal: lead.media_consumo || updated[0].consumo_mensal,
                };
                return updated;
              });
            }
          }
        }

        // ─── Fallback: if client has no lead, try to recover data from most recent proposal snapshot
        if (!cli.lead_id) {
          // Find the most recent proposta for this client
          const { data: lastProposta } = await supabase
            .from("propostas_nativas")
            .select("id")
            .eq("cliente_id", customerIdFromUrl)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastProposta?.id) {
            const { data: lastVersao } = await supabase
              .from("proposta_versoes" as any)
              .select("snapshot, potencia_kwp, valor_total")
              .eq("proposta_id", lastProposta.id)
              .order("versao_numero", { ascending: false })
              .limit(1)
              .maybeSingle();

            const snap = (lastVersao as any)?.snapshot as Record<string, any> | null;
            if (!cancelled && snap) {
              // Pre-fill tipo de telhado from snapshot
              const roofType = snap.roof_type || snap.locTipoTelhado;
              if (roofType) {
                const mapped = mapLeadTipoTelhadoToProposal(roofType) || roofType;
                setLocTipoTelhado(mapped);
              }

              // Pre-fill distribuidora — resolve ID by name with fuzzy matching
              const disNome = snap.dis_energia || snap.locDistribuidoraNome;
              const disId = snap.locDistribuidoraId;
              if (disId) {
                setLocDistribuidoraId(disId);
                if (disNome) setLocDistribuidoraNome(disNome);
              } else if (disNome) {
                setLocDistribuidoraNome(disNome);
                // Split words for fuzzy matching (e.g. "Energisa MG" → search each word)
                const words = disNome.split(/\s+/).filter((w: string) => w.length >= 2);
                let resolved = false;
                // Try exact ilike first
                const { data: conc } = await supabase
                  .from("concessionarias")
                  .select("id, nome")
                  .ilike("nome", `%${disNome}%`)
                  .limit(1)
                  .maybeSingle();
                if (conc?.id) {
                  setLocDistribuidoraId(conc.id);
                  setLocDistribuidoraNome(conc.nome);
                  resolved = true;
                }
                // Fallback: try matching by state abbreviation (e.g. "MG" → "Minas Gerais")
                if (!resolved && cli.estado) {
                  const { data: concByState } = await supabase
                    .from("concessionarias")
                    .select("id, nome")
                    .eq("estado", cli.estado)
                    .ilike("nome", `%${words[0]}%`)
                    .limit(1)
                    .maybeSingle();
                  if (concByState?.id) {
                    setLocDistribuidoraId(concByState.id);
                    setLocDistribuidoraNome(concByState.nome);
                    resolved = true;
                  }
                }
                // Last resort: search by first word only
                if (!resolved && words.length > 0) {
                  const { data: concWord } = await supabase
                    .from("concessionarias")
                    .select("id, nome")
                    .ilike("nome", `%${words[0]}%`)
                    .limit(1)
                    .maybeSingle();
                  if (concWord?.id) {
                    setLocDistribuidoraId(concWord.id);
                    setLocDistribuidoraNome(concWord.nome);
                  }
                }
              }

              // Pre-fill consumo from snapshot
              const consumo = snap.consumo_mensal || snap.ucs?.[0]?.consumo_kwh;
              if (consumo && consumo > 0) {
                setUcs(prev => {
                  const updated = [...prev];
                  if (updated[0].consumo_mensal === 0) {
                    updated[0] = { ...updated[0], consumo_mensal: consumo };
                  }
                  return updated;
                });
              }

              // Pre-fill kit items from snapshot
              if (snap.panel_model || snap.inverter_model) {
                const recoveredItens: KitItemRow[] = [];
                if (snap.panel_model) {
                  recoveredItens.push({
                    id: crypto.randomUUID(),
                    descricao: snap.panel_model,
                    fabricante: "",
                    modelo: snap.panel_model,
                    potencia_w: 0,
                    quantidade: snap.panel_quantity || 1,
                    preco_unitario: 0,
                    categoria: "modulo",
                    avulso: false,
                  });
                }
                if (snap.inverter_model) {
                  recoveredItens.push({
                    id: crypto.randomUUID(),
                    descricao: snap.inverter_model,
                    fabricante: "",
                    modelo: snap.inverter_model,
                    potencia_w: 0,
                    quantidade: snap.inverter_quantity || 1,
                    preco_unitario: 0,
                    categoria: "inversor",
                    avulso: false,
                  });
                }
                if (recoveredItens.length > 0) setItens(recoveredItens);
              }

              // Pre-fill venda from snapshot
              if (snap.equipment_cost || snap.installation_cost) {
                setVenda(prev => ({
                  ...prev,
                  custo_kit: snap.equipment_cost || prev.custo_kit,
                  custo_instalacao: snap.installation_cost || prev.custo_instalacao,
                }));
              }

            }
          }
        }

        toast({ title: "Dados carregados do projeto", description: `Cliente: ${cli.nome}` });
      } catch (err) {
        console.error("[ProposalWizard] Error loading project context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [customerIdFromUrl, dealIdFromUrl]);

  // ─── Auto-load from lead_id URL param (from PropostasTab selection)
  // When orc_id is also present, skip location pre-fill (ORC takes priority)
  useEffect(() => {
    if (!leadIdFromUrl || selectedLead?.id === leadIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    // If ORC is present, only load lead for context (name/phone) — ORC handles location
    const orcTakesPriority = !!orcIdFromUrl;
    let cancelled = false;
    (async () => {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, bairro, cep, rua, numero, complemento, valor_estimado, observacoes, area, municipio_ibge_codigo")
          .eq("id", leadIdFromUrl)
          .maybeSingle();
        if (cancelled || !lead) return;

        setSelectedLead({
          id: lead.id, nome: lead.nome, telefone: lead.telefone,
          lead_code: lead.lead_code || "", estado: lead.estado,
          cidade: lead.cidade, media_consumo: lead.media_consumo,
          geracao_estimada_kwh: lead.consumo_previsto || undefined,
          tipo_telhado: lead.tipo_telhado,
          rede_atendimento: lead.rede_atendimento,
          bairro: lead.bairro || undefined,
          cep: lead.cep || undefined,
          endereco: lead.rua || undefined,
          municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
          observacoes: lead.observacoes,
          source_type: "lead",

        });
        if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);

        // When ORC is present, skip location pre-fill — ORC data has priority
        if (!orcTakesPriority) {
          if (lead.estado) setLocEstado(lead.estado);
          if (lead.cidade) setLocCidade(lead.cidade);
          const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
          if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

          // consumo_previsto = geração estimada pelo vendedor, NÃO é consumo
          const consumo = lead.media_consumo || 0;
          const faseData = redeAtendimentoToFaseTensao(lead.rede_atendimento);

          setUcs(prev => {
            const updated = [...prev];
            updated[0] = {
              ...updated[0],
              estado: lead.estado || updated[0].estado,
              cidade: lead.cidade || updated[0].cidade,
              tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
              consumo_mensal: consumo || updated[0].consumo_mensal,
              ...(faseData ? {
                fase: faseData.fase,
                fase_tensao: faseData.fase_tensao,
                tensao_rede: faseData.tensao_rede,
              } : {}),
            };
            return updated;
          });

          toast({ title: "Dados do orçamento carregados", description: `Lead: ${lead.nome} — ${consumo} kWh` });
        }
      } catch (err) {
        console.error("[ProposalWizard] Error loading lead context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [leadIdFromUrl, orcIdFromUrl]);

  // ─── Auto-load from orc_id URL param (direct ORC click from PropostasTab)
  useEffect(() => {
    if (!orcIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: orc } = await supabase
          .from("orcamentos")
          .select("id, orc_code, lead_id, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, estado, cidade, area, observacoes")
          .eq("id", orcIdFromUrl)
          .maybeSingle();
        if (cancelled || !orc) return;

        // Pre-fill location from ORC (with tipo_telhado mapping)
        if (orc.estado) setLocEstado(orc.estado);
        if (orc.cidade) setLocCidade(orc.cidade);
        const mappedTelhado = mapLeadTipoTelhadoToProposal(orc.tipo_telhado);
        if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

        // Pre-fill UC data from ORC
        // consumo_previsto = geração estimada, não consumo médio
        const consumo = orc.media_consumo || orc.consumo_previsto || 0;
        const faseData = redeAtendimentoToFaseTensao(orc.rede_atendimento);

        setUcs(prev => {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            estado: orc.estado || updated[0].estado,
            cidade: orc.cidade || updated[0].cidade,
            tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
            consumo_mensal: consumo || updated[0].consumo_mensal,
            ...(faseData ? {
              fase: faseData.fase,
              fase_tensao: faseData.fase_tensao,
              tensao_rede: faseData.tensao_rede,
            } : {}),
          };
          return updated;
        });

        // Also load the lead linked to this ORC for full context
        if (orc.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado, municipio_ibge_codigo, observacoes")
            .eq("id", orc.lead_id)
            .maybeSingle();
          if (!cancelled && lead) {
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
              municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
              observacoes: lead.observacoes,
              orc_observacoes: orc.observacoes,
              source_type: "orcamento",

            });
            if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
          }
        }

        toast({
          title: "Dados do orçamento carregados",
          description: `${orc.orc_code || "ORC"} — ${consumo} kWh • ${orc.tipo_telhado || ""} • ${orc.rede_atendimento || ""}`,
        });
      } catch (err) {
        console.error("[ProposalWizard] Error loading ORC context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [orcIdFromUrl]);

  // ─── Validations per step key
  const canAdvance: Record<string, boolean> = {
    [STEP_KEYS.LOCALIZACAO]: !!locEstado && !!locCidade && !!locTipoTelhado && !!locDistribuidoraId,
    [STEP_KEYS.UCS]: consumoTotal > 0 && grupoValidation.valid,
    [STEP_KEYS.CAMPOS_PRE]: true,
    [STEP_KEYS.KIT]: itens.some(i => i.categoria === "modulo" && i.quantidade >= 1 && i.potencia_w > 0)
      && potenciaKwp > 0
      && ((venda.custo_kit_override ?? itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)) > 0),
    [STEP_KEYS.ADICIONAIS]: true,
    [STEP_KEYS.SERVICOS]: true,
    [STEP_KEYS.VENDA]: true,
    [STEP_KEYS.PAGAMENTO]: true,
    [STEP_KEYS.RESUMO]: true,
    [STEP_KEYS.PROPOSTA]: grupoValidation.valid,
  };

  const canCurrentStep = canAdvance[currentStepKey] ?? true;

  const resumoFinancialWarnings = useMemo(() => {
    const warnings: string[] = [];
    const custoBase = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const custoTotal = custoBase + venda.custo_instalacao + venda.custo_comissao + venda.custo_outros;

    if (precoFinal > 0 && custoTotal > 0 && precoFinal < custoTotal) {
      warnings.push(
        `Margem real negativa: o preço de venda (${formatBRL(precoFinal)}) está abaixo do custo total (${formatBRL(custoTotal)}).`
      );
    } else if (venda.margem_percentual <= 0) {
      warnings.push("Margem de lucro zerada ou negativa. O preço final pode não cobrir custos.");
    }

    return warnings;
  }, [itens, venda.custo_instalacao, venda.custo_comissao, venda.custo_outros, venda.margem_percentual, precoFinal]);

  // ─── Pre-generation: validate template before generating
  const handlePreGenerate = () => {
    if (!templateSelecionado) {
      toast({ title: "Template obrigatório", description: "Selecione um template de proposta antes de gerar.", variant: "destructive" });
      return;
    }
    handleGenerate();
  };

  // ─── Gate modal confirmed (warnings accepted) → proceed to pos-dimensionamento
  const handleGateConfirmed = () => {
    if (!nomeProposta && (cliente.nome || selectedLead?.nome)) {
      setNomeProposta(cliente.nome || selectedLead?.nome || "");
    }
    setShowPosDialog(true);
  };

  // ─── Generate (with enforcement gate)
  const handleGenerate = async () => {
    // Allow generation without a lead if client data is filled manually
    let effectiveLead = selectedLead;
    if (!effectiveLead) {
      if (cliente.nome && cliente.celular) {
        // Synthesize a lead-like object from manually entered client data
        effectiveLead = {
          id: crypto.randomUUID(),
          nome: cliente.nome,
          telefone: cliente.celular,
          lead_code: "",
          estado: cliente.estado || locEstado,
          cidade: cliente.cidade || locCidade,
          media_consumo: consumoTotal,
          tipo_telhado: locTipoTelhado,
          _synthetic: true,
        } as any;
        setSelectedLead(effectiveLead);
      } else {
        toast({ title: "Dados insuficientes", description: "Preencha pelo menos o nome e celular do cliente, ou selecione um lead.", variant: "destructive" });
        return;
      }
    }

    // ── Gate: pelo menos 1 forma de pagamento (FASE 1)
    if (!Array.isArray(pagamentoOpcoes) || pagamentoOpcoes.length === 0) {
      toast({
        title: "Forma de pagamento obrigatória",
        description: "Adicione pelo menos uma forma de pagamento na etapa Pagamento antes de gerar a proposta.",
        variant: "destructive",
      });
      return;
    }

    // ── Grupo consistency gate
    if (!grupoValidation.valid) {
      toast({
        title: "Erro de grupo tarifário",
        description: grupoValidation.error === "mixed_grupos"
          ? "Não é permitido misturar UCs de Grupo A e Grupo B na mesma proposta."
          : "Há UCs sem grupo tarifário definido. Defina o subgrupo de todas as UCs.",
        variant: "destructive",
      });
      return;
    }

    // ── Enforcement gate: block if missing variables or estimativa not accepted
    //   precoFinal, resolverPrecoTotal: resolverContext.precoTotal,
    //   potenciaKwp, resolverResult: enforcement.resolverResult,
    // });
    const gate = enforcement.checkGate();
    if (!gate.allowed) {
      console.warn("[ProposalWizard] PDF blocked:", gate);
      setBlockReason(gate.reason!);
      setBlockMissing(gate.missingVariables || []);
      setShowBlockModal(true);
      enforcement.logBlock(null, gate.reason!, gate.missingVariables || []);
      return;
    }

    setGenerating(true);
    setGenerationStatus("calculating");
    setGenerationError(null);
    setHtmlPreview(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setDocxBlob(null);
    setOutputDocxPath(null);
    setOutputPdfPath(null);
    setExternalPdfUrl(null);
    setResult(null);


    try {
      // Ensure draft is saved (creates project if needed) before generating
      let projetoId = savedProjetoId;
      let resolvedClienteId: string | null = savedClienteId;
      if (!projetoId) {
        const params = buildPersistParams(
          savedPropostaId || propostaIdFromUrl || null,
          savedVersaoId || versaoIdFromUrl || null,
        );
        let draftRes = await persistAtomic(params, "draft");

        // If blocked by concurrent save, wait and retry once
        if (draftRes.status === "blocked") {
          await new Promise(r => setTimeout(r, 2000));
          draftRes = await persistAtomic(params, "draft");
        }

        if (draftRes.status === "success" || draftRes.status === "reused") {
          if (draftRes.propostaId) setSavedPropostaId(draftRes.propostaId);
          if (draftRes.versaoId) setSavedVersaoId(draftRes.versaoId);
          if (draftRes.projetoId) {
            projetoId = draftRes.projetoId;
            setSavedProjetoId(draftRes.projetoId);
          }
          if (draftRes.dealId) setSavedDealId(draftRes.dealId);
          if (draftRes.clienteId) {
            resolvedClienteId = draftRes.clienteId;
            setSavedClienteId(draftRes.clienteId);
          }
        }
        if (!projetoId) {
          const errorDetail = draftRes.status === "error"
            ? (draftRes.reason || draftRes.message || "Erro desconhecido ao salvar rascunho")
            : draftRes.status === "blocked"
              ? "Outra operação de salvamento está em andamento. Tente novamente em alguns segundos."
              : "Não foi possível criar o projeto associado. Tente salvar o rascunho antes.";
          console.error("[ProposalWizard] Draft save failed:", draftRes);
          toast({ title: "Erro ao criar proposta", description: errorDetail, variant: "destructive" });
          setGenerating(false);
          return;
        }
      }

      // Fallback: if cliente_id still unknown but project exists, look it up
      if (!resolvedClienteId && projetoId) {
        const { data: projRow } = await supabase
          .from("projetos")
          .select("cliente_id")
          .eq("id", projetoId)
          .maybeSingle();
        if (projRow?.cliente_id) {
          resolvedClienteId = projRow.cliente_id;
          setSavedClienteId(projRow.cliente_id);
        }
      }

      const isSyntheticLead = !!(effectiveLead as any)?._synthetic;
      const realLeadId = isSyntheticLead ? undefined : effectiveLead!.id;
      // Prefer persisted clienteId (from draft RPC) over wizard-state synthetic flag
      const clienteIdForPayload = resolvedClienteId
        || (isSyntheticLead ? (effectiveLead as any)._clienteId : undefined);
      const idempotencyKey = generateIdempotencyKey(realLeadId || clienteIdForPayload || "no-lead");
      const payload: GenerateProposalPayload = {
        lead_id: realLeadId || undefined,
        cliente_id: clienteIdForPayload || undefined,
        projeto_id: projetoId,
        grupo: grupoValidation.grupo || (grupo.startsWith("B") ? "B" : "A"),
        idempotency_key: idempotencyKey,
        template_id: templateSelecionado || undefined,
        potencia_kwp: potenciaKwp,
        ucs: ucs.map(uc => ({
          nome: uc.nome,
          tipo_dimensionamento: uc.tipo_dimensionamento,
          distribuidora: uc.distribuidora,
          distribuidora_id: uc.distribuidora_id,
          subgrupo: uc.subgrupo,
          estado: uc.estado,
          cidade: uc.cidade,
          fase: uc.fase,
          tensao_rede: uc.tensao_rede,
          consumo_mensal: uc.consumo_mensal,
          consumo_meses: uc.consumo_meses,
          consumo_mensal_p: uc.consumo_mensal_p,
          consumo_mensal_fp: uc.consumo_mensal_fp,
          tarifa_distribuidora: uc.tarifa_distribuidora,
          tarifa_te_p: uc.tarifa_te_p,
          tarifa_tusd_p: uc.tarifa_tusd_p,
          tarifa_te_fp: uc.tarifa_te_fp,
          tarifa_tusd_fp: uc.tarifa_tusd_fp,
          demanda_preco: uc.demanda_preco ?? uc.demanda_consumo_kw ?? 0,
          demanda_contratada: uc.demanda_contratada ?? uc.demanda_geracao_kw ?? 0,
          demanda_adicional: uc.demanda_adicional ?? 0,
          custo_disponibilidade_kwh: uc.custo_disponibilidade_kwh,
          custo_disponibilidade_valor: uc.custo_disponibilidade_valor,
          outros_encargos_atual: uc.outros_encargos_atual,
          outros_encargos_novo: uc.outros_encargos_novo,
          distancia: uc.distancia,
          tipo_telhado: uc.tipo_telhado,
          inclinacao: uc.inclinacao,
          desvio_azimutal: uc.desvio_azimutal,
          taxa_desempenho: uc.taxa_desempenho,
          regra_compensacao: uc.regra_compensacao,
          rateio_sugerido_creditos: uc.rateio_sugerido_creditos,
          rateio_creditos: uc.rateio_creditos,
          imposto_energia: uc.imposto_energia,
          fator_simultaneidade: uc.fator_simultaneidade,
        })),
        premissas,
        itens: itens.filter(i => i.descricao).map(({ id, ...rest }) => rest),
        servicos: servicos.map(({ id, ...rest }) => rest),
        venda: (() => {
          // SSOT-guard: nunca enviar venda sem custo_instalacao numérico.
          // Fallback determinístico: servicos[categoria=instalacao, incluso_no_preco].
          // Evita regressão onde proposal-generate persiste valor_total sem instalação.
          const fallbackInstalacao = Number(
            servicos
              .filter(s => (s.categoria === "instalacao") && (s.incluso_no_preco !== false))
              .reduce((sum, s) => sum + (Number(s.valor) || 0), 0)
          ) || 0;
          const custoInstalacao = Number(venda.custo_instalacao);
          return {
            custo_kit: Number(venda.custo_kit) || 0,
            custo_instalacao: Number.isFinite(custoInstalacao) && custoInstalacao > 0
              ? custoInstalacao
              : fallbackInstalacao,
            custo_comissao: Number(venda.custo_comissao) || 0,
            custo_outros: Number(venda.custo_outros) || 0,
            margem_percentual: Number(venda.margem_percentual) || 0,
            desconto_percentual: Number(venda.desconto_percentual) || 0,
            observacoes: venda.observacoes ?? "",
          };
        })(),
        pagamento_opcoes: pagamentoOpcoes.map(({ id, ...rest }) => rest),
        observacoes: venda.observacoes || undefined,
        customFieldValues: customFieldValues ?? {},
        aceite_estimativa: enforcement.aceiteEstimativa || undefined,
        // Sistema/topologia derivados do kit selecionado pelo usuário (defaults no servidor).
        // Topologia normalizada via helper canônico (lowercase) — não reimplementar inline.
        kit: (() => {
          const meta = (manualKits[(selectedManualIdx ?? 0) as number] as any)?.meta;
          if (!meta) return undefined;
          const topologia = meta.topologia ? normalizeTopologyValue(meta.topologia) : undefined;
          const tipo_sistema = (meta.sistema === "hibrido" || meta.sistema === "off_grid" || meta.sistema === "on_grid")
            ? meta.sistema
            : undefined;
          if (!topologia && !tipo_sistema) return undefined;
          return { tipo_sistema, topologia };
        })(),
        // Wizard-specific state for edit round-trip (engine passes through, not used for calc)
        _wizard_state: {
          selectedLead,
          cliente,
          projectAddress,
          preDimensionamento,
          layouts,
          manualKits,
          adicionais,
          customFieldValues,
          nomeProposta,
          descricaoProposta,
          templateSelecionado,
          locSkipPoa,
          locLatitude,
          locGhiSeries,
          locDistribuidoraId,
          geracaoMensalEstimada,
          // FIX hidratação Pagamento: preserva tipo "direto" + forma_pagamento
          // (PIX/transferência/boleto/cartão) que o engine não tipa.
          pagamentoOpcoes,
        },
      };

      setGenerationStatus("publishing");
      const genResult = await generateProposal(payload);
      setResult(genResult);
      clearLocal(); // Proposta gerada — limpar rascunho local
      setOfficialTotal(precoFinal); // Update official total state to hide divergence banner
      setOfficialTemplateId(templateSelecionado); // Update official template to hide divergence banner
      setHasEditsAfterRestore(false); // Reset edit tracking

      // Sync template_id_used on the new version (RB-54) — belt-and-suspenders
      // proposal-generate already sets it server-side, but sync as fallback
      syncTemplateIdUsed(genResult.versao_id);

      // Invalidate caches so project detail / kanban / proposal lists reflect new version
      invalidateProposalCaches(resolvedDealId, projetoId);

      // Audit is now persisted by the backend — no need for frontend persistAudit

      // ── Background Rendering Logic (Decoupled)
      const selectedTpl = proposalTemplates.find(t => t.id === templateSelecionado);
      const isDocxTemplate = selectedTpl?.tipo === "docx";

      setGenerationStatus("ready_web");
      setGenerating(false); // Liberar UI imediatamente
      toast({
        title: "Proposta publicada!",
        description: "A versão Web está pronta. O PDF está sendo preparado em segundo plano.",
      });

      if (isDocxTemplate && genResult.proposta_id) {
        setSavedVersaoId(genResult.versao_id); // Ensure polling logic uses the new version ID
        setRendering(true);
        setGenerationStatus("rendering_pdf");
        
        // Mark version as generating in DB so we can pick it up if user leaves
        await supabase
          .from("proposta_versoes")
          .update({ generation_status: "rendering_pdf" } as any)
          .eq("id", genResult.versao_id);
        
        // Trigger Edge Function in background without awaiting its completion for the UI
        (async () => {
          try {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";
            const { data: { session } } = await supabase.auth.getSession();
            
            // We still fire the request to start the process
            await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${session?.access_token || anonKey}`,
                "apikey": anonKey,
                "x-client-timeout": "10", // Low timeout since we poll anyway
              },
              body: JSON.stringify({
                template_id: templateSelecionado,
                proposta_id: genResult.proposta_id,
                response_format: "json",
              }),
            }).catch(e => console.warn("[ProposalWizard] Background trigger fetch finished/aborted:", e.message));
          } catch (e) {
            console.warn("[ProposalWizard] Background trigger error (expected if timeout is low):", e);
          }
        })();
      } else if (!isDocxTemplate) {
        setSavedVersaoId(genResult.versao_id); // Ensure polling logic uses the new version ID
        // HTML templates are fast, but let's follow the same pattern for consistency
        setRendering(true);
        setGenerationStatus("rendering_pdf");

        // Mark version as generating in DB so we can pick it up if user leaves
        await supabase
          .from("proposta_versoes")
          .update({ generation_status: "rendering_pdf" } as any)
          .eq("id", genResult.versao_id);
        (async () => {
          try {
            const renderResult = await renderProposal(genResult.versao_id);
            setHtmlPreview(renderResult.html);
            setGenerationStatus("ready");
            setRendering(false);
            
            // Explicitly mark as completed in DB for HTML templates too
            await supabase
              .from("proposta_versoes")
              .update({ generation_status: "ready" } as any)
              .eq("id", genResult.versao_id);
          } catch (e: any) {
            setGenerationStatus("error");
            setGenerationError(e.message || "Erro ao renderizar HTML");
            
            // Mark as error in DB
            await supabase
              .from("proposta_versoes")
              .update({ 
                generation_status: "error",
                generation_error: e.message || "Erro ao renderizar HTML"
              } as any)
              .eq("id", genResult.versao_id);
          }
        })();
      }

      // Save pricing history for smart defaults in future proposals
      const instalacaoVal = servicos.find(s => s.categoria === "instalacao")?.valor || 0;
      savePricingHistory({
        potenciaKwp,
        margemPercentual: venda.margem_percentual,
        custoComissao: venda.custo_comissao,
        custoOutros: venda.custo_outros,
        custoInstalacao: instalacaoVal,
        propostaId: genResult.proposta_id,
      }).catch(e => console.error("Error saving pricing history:", e));
    } catch (e: any) {
      // ── Consolidate catch for handleGenerate ──
      const errorCode = (e as any).errorCode;
      if (errorCode === "missing_required_variables") {
        setBlockReason("missing_required");
        setBlockMissing((e as any).missing || []);
        setShowBlockModal(true);
      } else if (errorCode === "estimativa_not_accepted") {
        setBlockReason("estimativa_not_accepted");
        setBlockMissing([]);
        setShowBlockModal(true);
      } else if (errorCode === "mixed_grupos" || errorCode === "grupo_indefinido") {
        toast({
          title: "Erro de grupo tarifário",
          description: e.message || "Não é permitido misturar Grupo A e Grupo B na mesma proposta.",
          variant: "destructive",
        });
      } else {
        setGenerationStatus("error");
        setGenerationError(e.message || "Erro desconhecido ao publicar proposta");
        toast({ title: "Erro na publicação", description: e.message, variant: "destructive" });
      }
      setGenerationStatus("idle");
    } finally {
      setGenerating(false);
    }
  };

  // ─── Invalidate artifacts when template changes
  const handleTemplateChange = useCallback((newTemplateId: string) => {
    setTemplateSelecionado(newTemplateId);
    // Clear ALL stale artifacts when template changes
    if (result) {
      setResult(null);
      setHtmlPreview(null);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
      setDocxBlob(null);
      setOutputDocxPath(null);
      setOutputPdfPath(null);
      setGenerationStatus("idle");
      setGenerationError(null);
      setMissingVars([]);
      setGenerationAuditReport(null);
    }
  }, [result, pdfBlobUrl]);

  const handleNewVersion = () => {
    // idempotency key is now generated fresh each time — no need to clear
    setResult(null);
    setHtmlPreview(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setDocxBlob(null);
    setOutputDocxPath(null);
    setOutputPdfPath(null);
    setGenerationStatus("idle");
    setGenerationError(null);
    setMissingVars([]);
    // Go back to UCs step
    const ucsIndex = activeSteps.findIndex(s => s.key === STEP_KEYS.UCS);
    setStep(ucsIndex >= 0 ? ucsIndex : 1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const goToStep = (target: number) => {
    // Only allow navigating to completed (past) steps — never forward
    if (target < step) {
      setStep(target);
    }
  };

  const goNext = () => {
    if (step >= activeSteps.length - 1) return;

    // Intercept: validate Kit step — block if kit cost is zero
    if (currentStepKey === STEP_KEYS.KIT && itens.length > 0) {
      const custoKit = (venda.custo_kit_override != null && venda.custo_kit_override > 0)
        ? venda.custo_kit_override
        : itens.reduce((s, i) => s + (i.quantidade ?? 0) * (i.preco_unitario ?? 0), 0);
      if (custoKit <= 0) {
        toast({
          title: "Kit com custo zerado",
          description: "O kit selecionado possui custo R$ 0,00. Edite o kit ou selecione outro antes de prosseguir.",
          variant: "destructive",
        });
        return;
      }
    }

    // Intercept: when advancing FROM Resumo → run validation gate THEN pos-dimensionamento
    const nextKey = activeSteps[step + 1]?.key;
    if (currentStepKey === STEP_KEYS.RESUMO && nextKey === STEP_KEYS.PROPOSTA) {
      // Run canonical validation before allowing navigation
      // SSOT: economia_mensal vem do snapshot canônico (calcFinancialSeries) — nunca de geração×tarifa.
      const _snap = collectSnapshot() as any;
      const _econSnap = typeof _snap?.economia_mensal === "number" ? _snap.economia_mensal : 0;
      const validation = validatePropostaFinal({
        cliente,
        selectedLead,
        ucs,
        itens,
        servicos,
        venda,
        pagamentoOpcoes,
        potenciaKwp,
        precoFinal,
        geracaoMensalKwh: geracaoMensalEstimada,
        consumoTotal,
        economiaMensal: _econSnap > 0 ? _econSnap : 0,
        locEstado,
        locCidade,
        locDistribuidoraNome: locDistribuidoraNome,
        templateSelecionado,
        skipTemplateCheck: true, // Template is selected in the Proposta step — don't block here
      });

      // If there are errors or warnings → show gate modal (blocks navigation)
      if (!validation.canGenerate || validation.needsConfirmation) {
        setGateValidation(validation);
        setShowGateModal(true);
        return;
      }

      // Validation clean → show pos-dimensionamento dialog
      if (!nomeProposta && (cliente.nome || selectedLead?.nome)) {
        setNomeProposta(cliente.nome || selectedLead?.nome || "");
      }
      setShowPosDialog(true);
      return;
    }
    setStep(step + 1);
  };

  const handlePosDialogConfirm = () => {
    setShowPosDialog(false);
    setStep(step + 1);
  };

  const goPrev = () => {
    setStep(Math.max(0, step - 1));
  };

  const isLastStep = currentStepKey === STEP_KEYS.PROPOSTA;

  // ─── Render step content by key
  const stepMeta = STEP_META[currentStepKey] || { title: "", description: "" };
  const currentStepDef = activeSteps[step];

  const renderStepContent = () => {

    const wrap = (key: string, children: React.ReactNode, headerRight?: React.ReactNode) => (
      <StepContent key={key}>
        <WizardStepCard
          title={stepMeta.title}
          description={stepMeta.description}
          icon={currentStepDef?.icon}
          headerRight={headerRight ?? (
            <span className="text-xs font-mono text-primary font-bold">
              Etapa {step + 1}/{activeSteps.length}
            </span>
          )}
        >
          {children}
        </WizardStepCard>
      </StepContent>
    );

    // Client + Lead cards for header
    const clientHeaderCard = (cliente.nome || selectedLead) ? (
      <div className="flex items-center gap-2 text-xs">
        {/* Cliente card — always left */}
        {cliente.nome && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary font-semibold">Cliente</Badge>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary shrink-0" />
              {cliente.nome}
            </span>
            {cliente.celular && (
              <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                <Phone className="h-3 w-3 shrink-0" /> {cliente.celular}
              </span>
            )}
          </div>
        )}
        {/* Lead card — always right */}
        {selectedLead && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-secondary/30 bg-secondary/5">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-secondary/40 text-secondary font-semibold">Lead</Badge>
            <span className="font-semibold text-foreground">{selectedLead.nome}</span>
            {selectedLead.telefone && (
              <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                <Phone className="h-3 w-3 shrink-0" /> {selectedLead.telefone}
              </span>
            )}
          </div>
        )}
      </div>
    ) : null;

    switch (currentStepKey) {
      case STEP_KEYS.LOCALIZACAO:
        return wrap("localizacao", (
          <div className="space-y-4">
            <StepLocalizacao />
            {/* Cliente section — only show full form when NOT from project */}
            {!projectContext && (
              <div className="border-t border-border/50 pt-4">
                <StepCliente fromProject={false} />
              </div>
            )}
          </div>
        ), clientHeaderCard);

      case STEP_KEYS.UCS:
        return wrap("ucs", (
          <>
            {/* Grupo consistency alert */}
            {(isGrupoMixed || isGrupoUndefined) && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {isGrupoMixed
                      ? "Mistura de Grupo A e Grupo B detectada"
                      : "Grupo tarifário indefinido"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isGrupoMixed
                      ? "Não é permitido misturar Unidades Consumidoras de Grupo A e Grupo B na mesma proposta. As estruturas tarifárias são diferentes."
                      : "Uma ou mais UCs não possuem subgrupo tarifário definido. Defina o subgrupo para continuar."}
                  </p>
                  {grupoValidation.divergentIndices && grupoValidation.divergentIndices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {grupoValidation.divergentIndices.map(idx => (
                        <Badge key={idx} variant="destructive" className="text-[10px]">
                          UC {idx + 1} — {grupoValidation.grupos[idx] ?? "indefinido"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <StepConsumptionIntelligence />
          </>
        ));

      case STEP_KEYS.CAMPOS_PRE:
        return wrap("campos_pre", (
          <StepCamposCustomizados />
        ));

      case STEP_KEYS.KIT: {
        const kitVal = validateKit(itens, potenciaKwp, venda.custo_kit_override);
        return wrap("kit", (
          <div className="space-y-4">
            <StepKitSelection onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
            {(kitVal?.warnings ?? []).length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-1">
                {(kitVal?.warnings ?? []).map((w, i) => (
                  <p key={i} className="text-xs text-warning font-medium flex items-center gap-1.5">
                    <span className="shrink-0">⚠</span> {w}
                  </p>
                ))}
              </div>
            )}
            {(kitVal?.errors ?? []).length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                {(kitVal?.errors ?? []).map((e, i) => (
                  <p key={i} className="text-xs text-destructive font-medium flex items-center gap-1.5">
                    <span className="shrink-0">✕</span> {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        ));
      }

      case STEP_KEYS.ADICIONAIS:
        return wrap("adicionais", (
          <StepAdicionais onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
        ));

      case STEP_KEYS.SERVICOS:
        return wrap("servicos", (
          <StepServicos onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
        ));

      case STEP_KEYS.VENDA:
        return wrap("venda", (
          <StepFinancialCenter onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
        ));

      case STEP_KEYS.PAGAMENTO:
        return wrap("pagamento", (
          <StepPagamento onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
        ));

      case STEP_KEYS.RESUMO:
        return wrap("resumo", (
          <StepResumo onBack={() => setStep(step - 1)} onNext={() => setStep(step + 1)} />
        ));

      case STEP_KEYS.PROPOSTA:
        return wrap("proposta", (
          <>
            {/* Enforcement: EstimativaCheckbox before generation */}
            <EstimativaCheckbox
              precisao={enforcement.precisao}
              checked={enforcement.aceiteEstimativa}
              onCheckedChange={enforcement.setAceiteEstimativa}
              className="mb-4"
            />
            <StepDocumento
              externalPdfUrl={externalPdfUrl}
              onBack={() => setStep(step - 1)}
              onViewDetail={handleViewDetail}
              estimativaBlocked={enforcement.precisao === "estimado" && !enforcement.aceiteEstimativa}
              onGenerate={handlePreGenerate}
              onNewVersion={handleNewVersion}
              generating={generating}
              rendering={rendering}
              result={result}
              hasUnpublishedChanges={hasEditsAfterRestore}
              officialTotal={officialTotal}
              draftTotal={precoFinal}
              htmlPreview={htmlPreview}
              pdfBlobUrl={pdfBlobUrl}
              outputDocxPath={outputDocxPath}
              outputPdfPath={outputPdfPath}
              generationError={generationError}
              missingVars={missingVars}
              docxBlob={docxBlob}
              generationAuditReport={generationAuditReport}
            />
          </>
        ));

      default:
        return null;
    }
  };

  // ─── Render
  return (
    <div className="proposal-wizard-root flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* ── Sticky Header — breadcrumb + client + metrics */}
      <div className="shrink-0 border-b border-border/60 bg-card px-4 lg:px-6 py-2.5 space-y-1">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {savedProjetoId ? (
            <>
              <Link to="/admin/projetos" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                Projetos
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <Link
                to={`/admin/projetos?projeto=${savedProjetoId}`}
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {projetoBreadcrumb?.codigo ? `Projeto #${projetoBreadcrumb.codigo}` : "Projeto"}
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            </>
          ) : (
            <>
              <Link to="/admin/propostas-nativas" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                Propostas
              </Link>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            </>
          )}
          <span className="font-medium text-foreground">
            {savedPropostaId ? "Proposta" : "Nova Proposta"}
          </span>
        </div>

        {/* Client name + metrics row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-foreground truncate">
            {cliente.nome || selectedLead?.nome || (savedPropostaId ? "Editar Proposta" : "Nova Proposta")}
          </h1>
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {potenciaKwp > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Potência Total</p>
                  <p className="text-xs font-bold text-foreground">{(Number(potenciaKwp) || 0).toFixed(2)} kWp</p>
                </div>
              </div>
            )}
            {consumoTotal > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <BarChart3 className="h-3.5 w-3.5 text-secondary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Consumo</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(consumoTotal)} kWh</p>
                </div>
              </div>
            )}
            {!!(selectedLead as any)?.geracao_estimada_kwh && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-warning/40 bg-warning/5"
                title="Geração prevista informada pelo cliente no lead (referência visual)"
              >
                <SunMedium className="h-3.5 w-3.5 text-warning" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Cliente quer (Geração Prev.)</p>
                  <p className="text-xs font-bold text-foreground">
                    {formatNumberBR(Math.round(Number((selectedLead as any).geracao_estimada_kwh) || 0))} kWh
                  </p>
                </div>
              </div>
            )}
            {geracaoMensalEstimada > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <SunMedium className="h-3.5 w-3.5 text-warning" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Geração Estimada</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(Math.round(geracaoMensalEstimada))} kWh/mês</p>
                </div>
              </div>
            )}
            {precoFinal > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Preço do Projeto</p>
                  <p className="text-xs font-bold text-foreground">
                    {formatBRL(precoFinal)}{" "}
                    {potenciaKwp > 0 && (
                      <span className="text-[9px] font-normal text-muted-foreground">
                        R$ {((Number(precoFinal) || 0) / (Number(potenciaKwp) || 1) / 1000).toFixed(2)}/Wp
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Context Banner */}
      {projectContext && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 border-b border-primary/20 bg-primary/5 shrink-0">
          <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-[11px] font-medium text-primary">
            Proposta vinculada ao projeto — dados carregados automaticamente
          </p>
        </div>
      )}

      {/* Sent Proposal Warning Banner */}
      {editingsentProposal && hasEditsAfterRestore && (
        <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-warning/30 bg-warning/10 shrink-0">
          <PropostaBadge type="enviada" className="bg-warning/10 text-warning border-warning/30" />
          <p className="text-sm font-medium text-warning">
            Essa proposta já foi enviada/gerada. Ao salvar, uma nova versão será criada com um novo link.
          </p>
        </div>
      )}


      {/* Accepted Proposal Permanent Warning Banner */}
      {proposalStatus === "aceita" && (
        <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-destructive bg-destructive text-destructive-foreground shrink-0 animate-pulse z-50">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            ESTA PROPOSTA ESTÁ ACEITA PELO CLIENTE. QUALQUER ALTERAÇÃO PODE INVALIDAR O CONTRATO ASSINADO.
          </p>
        </div>
      )}

      {ClientContextPanel}


      {/* Unpublished Changes Banner */}
      {hasEditsAfterRestore && officialTotal > 0 && (Math.abs(precoFinal - officialTotal) > 0.01 || (officialTemplateId && templateSelecionado !== officialTemplateId)) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 lg:px-6 py-3 border-b border-amber-500/50 bg-amber-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100/50 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 leading-tight">Você possui alterações não publicadas</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Para atualizar o projeto e os indicadores do CRM, publique uma nova versão.</p>
              <div className="flex items-center gap-3 text-xs text-amber-700 mt-1.5">
                <span className="flex items-center gap-1.5"><Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 bg-white uppercase">OFICIAL</Badge> {formatBRL(officialTotal)}</span>
                <ChevronRight className="h-3 w-3 opacity-50" />
                <span className="flex items-center gap-1.5"><Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-amber-500 text-white border-0 uppercase">RASCUNHO</Badge> {formatBRL(precoFinal)}</span>
              </div>
              {officialTemplateId && templateSelecionado !== officialTemplateId && (
                <p className="text-[10px] text-amber-600 mt-1 font-medium italic">
                  * Template alterado: {proposalTemplates.find(t => t.id === officialTemplateId)?.nome || "Antigo"} → {proposalTemplates.find(t => t.id === templateSelecionado)?.nome || "Novo"}
                </p>
              )}
            </div>
          </div>
          <Button 
            size="sm" 
            className="bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-sm gap-2 w-full sm:w-auto"
            onClick={() => {
              const propostaIndex = activeSteps.findIndex(s => s.key === STEP_KEYS.PROPOSTA);
              if (propostaIndex >= 0) setStep(propostaIndex);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Publicar nova versão agora
          </Button>
        </div>
      )}

      {/* Migrated proposal without editable kit */}
      {migratedKitMissing && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 border-b border-amber-500/30 bg-amber-500/10 shrink-0">
          <PropostaBadge type="migrada" className="bg-amber-500/10 text-amber-600 border-amber-500/30" />
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Esta proposta importada não possui kit técnico editável. Use "Duplicar proposta" para criar uma versão editável ou refaça o kit manualmente.
          </p>
        </div>
      )}


      {/* ── Pipeline stepper — responsive: scrollable on mobile, full on desktop */}
      <div className="relative shrink-0 border-b-2 border-secondary/10 bg-gradient-to-b from-card to-muted/20">
        {/* Progress track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-secondary to-primary rounded-r-full shadow-sm shadow-secondary/30"
            initial={{ width: "0%" }}
            animate={{ width: `${((step) / (activeSteps.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
        {/* Scrollable container on mobile */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center px-2 sm:px-4 py-3 gap-0 min-w-max sm:min-w-0 sm:justify-center lg:justify-start">
            {activeSteps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.key} className="flex items-center flex-shrink-0">
                  <motion.button
                    onClick={() => { if (isDone) goToStep(i); }}
                    className={cn(
                      "relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap border",
                      isActive && "bg-primary text-primary-foreground shadow-sm border-primary",
                      isDone && "bg-secondary/10 text-secondary border-secondary/20 cursor-pointer hover:bg-secondary/15",
                      !isActive && !isDone && "text-muted-foreground border-transparent cursor-default",
                    )}
                    initial={false}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    whileHover={isDone ? { scale: 1.02 } : undefined}
                  >
                    <span className={cn(
                      "flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[10px] shrink-0 transition-colors",
                      isActive && "bg-primary-foreground/25",
                      isDone && "bg-secondary/20 text-secondary",
                      !isActive && !isDone && "bg-muted",
                    )}>
                      {isDone ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                          <Check className="h-3 w-3" />
                        </motion.span>
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </span>
                    {/* Show labels on md+ screens */}
                    <span className="hidden md:block">{s.label}</span>
                  </motion.button>
                  {i < activeSteps.length - 1 && (
                    <div className="flex items-center mx-0.5 sm:mx-1">
                      <ChevronRight className={cn(
                        "h-3 w-3 sm:h-4 sm:w-4 transition-colors duration-300",
                        isDone ? "text-secondary" : "text-muted-foreground/30",
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body: Content — responsive padding, max-width for readability */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="w-full px-2 sm:px-3 lg:px-4 py-2 lg:py-3 pb-24 sm:pb-20">
          {editingsentProposal && hasEditsAfterRestore && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900">Alterações não publicadas</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    O valor oficial do projeto continuará sendo <span className="font-bold">{formatBRL(precoFinal)}</span> até que você salve uma nova versão.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>

          {/* Audit Panel — visible in debug mode */}
          {debugMode && (
            <div className="mt-4">
              <ProposalAuditPanel
                snapshot={collectSnapshot()}
                propostaId={savedPropostaId}
                versaoId={savedVersaoId}
                projetoId={savedProjetoId || null}
                dealId={resolvedDealId || dealIdFromUrl || null}
                clienteId={customerIdFromUrl || null}
                leadId={selectedLead?.id || leadIdFromUrl || null}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Footer Navigation — responsive */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-auto flex items-center justify-between px-4 lg:px-6 py-3 border-t border-border/60 bg-card shrink-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:shadow-none">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 h-9 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            Cancelar
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
              Etapa {step + 1}/{activeSteps.length}
            </span>

            {isAdminOrGerente && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                <Switch id="debug-toggle" checked={debugMode} onCheckedChange={setDebugMode} className="scale-75" />
                <Label htmlFor="debug-toggle" className="text-[10px] text-muted-foreground cursor-pointer select-none">Debug</Label>
              </div>
            )}

            <div className="h-6 w-px bg-border/50 hidden sm:block" />

            <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1.5 h-9 text-xs font-medium">
              <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voltar</span>
            </Button>
            {!isLastStep && (
              <Button
                size="sm"
                onClick={goNext}
                disabled={!canCurrentStep}
                className="gap-1.5 h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200"
              >
                Prosseguir
              </Button>
            )}
            {isLastStep && (savedDealId || resolvedDealId) && (
              <Button
                size="sm"
                onClick={() => {
                  const targetId = savedDealId || resolvedDealId;
                  if (targetId) navigate(`/admin/projetos?projeto=${targetId}&tab=propostas`);
                }}
                className="gap-1.5 h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200"
              >
                Prosseguir
              </Button>
            )}
          </div>
        </div>

      {/* Pos-dimensionamento dialog */}
      <DialogPosDimensionamento
        open={showPosDialog}
        onOpenChange={setShowPosDialog}
        clienteNome={cliente.nome || selectedLead?.nome || ""}
        empresaNome={cliente.empresa || cliente.nome || selectedLead?.nome || ""}
        potenciaKwp={potenciaKwp}
        precoFinal={precoFinal}
        nomeProposta={nomeProposta}
        onNomePropostaChange={setNomeProposta}
        descricaoProposta={descricaoProposta}
        onDescricaoPropostaChange={setDescricaoProposta}
        customFieldValues={customFieldValues}
        onCustomFieldValuesChange={setCustomFieldValues}
        financialWarnings={resumoFinancialWarnings}
        onConfirm={handlePosDialogConfirm}
        kitItems={itens}
        onSaveDraft={() => handleUpdate(false)}
        onSaveActive={() => handleUpdate(true)}
        saving={saving || isRestoring}
        savedPropostaId={savedPropostaId || propostaIdFromUrl}
      />

      {/* Enforcement: block modal */}
      <MissingVariablesModal
        open={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        missingVariables={blockMissing}
        reason={blockReason}
      />

      <Dialog open={showNewVersionConfirm} onOpenChange={setShowNewVersionConfirm}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border text-left">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Criar nova versão da proposta?
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-5">
            <DialogDescription className="text-sm text-foreground leading-relaxed">
              Esta proposta já foi enviada ao cliente. Ao continuar, uma nova versão será criada com um novo link. O cliente precisará receber o link atualizado.
            </DialogDescription>
          </div>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="ghost" onClick={() => setShowNewVersionConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                setShowNewVersionConfirm(false);
                if (pendingUpdateAction !== null) {
                  handleUpdate(pendingUpdateAction);
                  setPendingUpdateAction(null);
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Criar nova versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-generation gate modal */}
      {gateValidation && (
        <PreGenerationGateModal
          open={showGateModal}
          onOpenChange={setShowGateModal}
          validation={gateValidation}
          onConfirmGenerate={handleGateConfirmed}
        />
      )}
}
