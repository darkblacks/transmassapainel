# V17.13 - Migração para banco operacional

Esta versão remove do frontend as dependências explícitas do espelho PostgreSQL e do módulo de abastecimento.

## Alterações
- Removida aba e KPI de Combustível do histórico do veículo.
- Removida linha de combustível do gráfico.
- Removido texto "Fonte única API 8090".
- `getVehicleInsights` não chama mais `/api/mirror/vehicle/:plate`.
- Histórico geral de OS passa a consumir `/api/history/service-orders`.
- Frontend está preparado para receber OS, serviços e peças do backend conectado ao MySQL `transmassa`.

## Backend ainda necessário
O ZIP recebido contém somente o frontend React. Para concluir a migração direta, o backend AWS:8080 precisa implementar/ajustar:
- `/api/history/service-orders` -> tabelas `os`, `os_pecas`, `os_servicos`, `oficinas`;
- `/api/fleet-insights/vehicle/:plate` -> `manifestos`, `frete_manifesto`, `fretes`, `notas_fiscais`, `os`, `os_pecas`, `os_servicos`;
- remover dependências de `esl_mirror_records`, `v_esl_open_service_orders` e API 8090 nesses endpoints.
