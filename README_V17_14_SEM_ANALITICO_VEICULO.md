# V17.14 — painel sem analítico por veículo

Alterações:
- removido o clique na linha do veículo que abria o drawer analítico;
- removido o componente `FleetAnalytics.tsx`;
- removidas as chamadas frontend para `/api/fleet-insights/monthly` e `/api/fleet-insights/vehicle/:plate`;
- mantidas as demais páginas: filiais, painel, mapeamento/grupos, cavalos/carretas e histórico de OS;
- mantido o botão de expansão da linha para detalhes operacionais/OS.

O frontend continua apontando para o backend configurado no Vite e usa o overview atual para status da frota.
