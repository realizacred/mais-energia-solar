-- Atualizar rede_atendimento legado em leads
UPDATE public.leads SET rede_atendimento = 'Monofásico 127V' WHERE rede_atendimento = 'Monofásico';
UPDATE public.leads SET rede_atendimento = 'Bifásico 127/220V' WHERE rede_atendimento = 'Bifásico';
UPDATE public.leads SET rede_atendimento = 'Trifásico 127/220V' WHERE rede_atendimento = 'Trifásico';

-- Atualizar rede_atendimento legado em orcamentos
UPDATE public.orcamentos SET rede_atendimento = 'Monofásico 127V' WHERE rede_atendimento = 'Monofásico';
UPDATE public.orcamentos SET rede_atendimento = 'Bifásico 127/220V' WHERE rede_atendimento = 'Bifásico';
UPDATE public.orcamentos SET rede_atendimento = 'Trifásico 127/220V' WHERE rede_atendimento = 'Trifásico';