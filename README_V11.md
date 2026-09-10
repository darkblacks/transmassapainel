# Transmassa Painel V11 · Analytics de Frota

Baseado no último front V7.10, mantendo:
- painel operacional normal;
- KPIs de status;
- filtros e grupos;
- histórico cavalo/carreta;
- expansão de linha;
- histórico de OS.

Adicionado:
- Recharts;
- cards de Combustível, Manutenção, Total R$ em NF e Serviços;
- 4 gráficos mês a mês;
- linha principal clicável;
- drawer lateral por veículo com histórico de combustível, OS, serviços e peças;
- visão de 24 meses por veículo.

Rotas novas esperadas no backend público (8080):
- POST /api/fleet-insights/monthly
- GET /api/fleet-insights/vehicle/:plate?months=24

Enquanto essas rotas ainda não estiverem publicadas, o front mostra o painel normal e exibe a área analítica como “aguardando backend”, sem inventar dados.

Observação: Total R$ em NF deve ser ligado à relação real NF↔manifesto/veículo antes de produção; não usar totalValorFretes como se fosse valor de NF.
