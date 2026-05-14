      <EmitirReciboModal
        open={emitirOpen}
        onOpenChange={setEmitirOpen}
        defaultClienteId={customerId ?? undefined}
        defaultProjetoId={projetoId ?? undefined}
        defaultDealId={dealId}
        onEmitted={() => {
          const queryClient = useQueryClient();
          queryClient.invalidateQueries({ queryKey: ["recibos", { deal_id: dealId }] });
          queryClient.invalidateQueries({ queryKey: ["projeto-detalhe"] });
          queryClient.invalidateQueries({ queryKey: ["lancamentos-financeiros"] });
        }}
      />
