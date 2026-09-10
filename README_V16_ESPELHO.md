# V14.1 + Backend V16 / Espelho ESL

Este frontend foi feito diretamente sobre o arquivo:
`transmassapainel_FRONT_v14_1_SEM_STALE_SEM_LOOP`

## Mantido exatamente da V14.1
- identidade visual;
- painel principal;
- KPIs e filtros;
- grupos;
- histórico de cavalos e carretas;
- histórico de OS;
- linha expandida;
- drawer do veículo;
- manifestos;
- login;
- Netlify e proxy `/backend`.

## Conexões atualizadas
- operação/manifestos: rotas operacionais existentes;
- manutenção atual: backend V16 usando OS aberta do PostgreSQL;
- OS: `/api/mirror/records/service_orders`;
- histórico individual: `/api/mirror/vehicle/:plate`;
- combustível: espelho PostgreSQL;
- serviços: espelho PostgreSQL;
- peças: espelho PostgreSQL.

O histórico antigo não é usado como fallback quando o espelho V16 falha.
