# V17.15 — Mapeamento de Frota simplificado

Base: V17.14 sem analítico por veículo.

## Nova regra cadastral por placa
Cada placa do grupo possui somente:
- Placa
- Tipo corrigido: Fiorino, 3/4, Truck, Acelo, Toco, Cavalo, Carreta/Baú
- Filial: SP, RJ ou RB
- Vínculo: Próprio ou Terceiro
- Terceiro cadastrado (quando o vínculo for Terceiro)

Motorista, serviço e observação deixam de fazer parte da edição estrutural do grupo.

## Motorista no painel
- COMMITTED / IN_TRANSIT: sempre usa o motorista do manifesto; mapeamento manual nunca sobrepõe.
- AVAILABLE: pode usar `driver_name` legado se existir; vazio mostra —.
- MAINTENANCE: mostra a OS.

## Novidades da tela
- Criação de grupos.
- Edição de qualquer grupo retornado pela API.
- Aba Frota com os cinco campos da nova regra.
- Aba Terceiros para cadastrar, editar, ativar/inativar e remover prestadores/agregados.
- Filtros por filial e vínculo.
- Padronização visual das filiais, incluindo `RB - Ribeirão Preto`.

## Endpoints esperados no backend
Os endpoints já existentes de membros continuam sendo usados. A nova tela também espera:
- POST `/api/fleet-mapping/groups`
- GET `/api/fleet-mapping/third-parties`
- POST `/api/fleet-mapping/third-parties`
- PUT `/api/fleet-mapping/third-parties/:id`
- DELETE `/api/fleet-mapping/third-parties/:id`

Os membros passam a aceitar/devolver `ownership` e `third_party_id`.

Durante a migração, `owner_code` continua sendo enviado como compatibilidade quando uma placa é Terceiro.
