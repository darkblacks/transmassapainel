# V14 — Fonte única API

- Drawer do veículo usa exclusivamente `/api/fleet-insights/vehicle/:plate`.
- Sem fallback/mock/cache local para manutenção e combustível.
- Requisições analíticas usam cache-bust e validam a placa retornada.
- `/historico-os` não usa mais `maintenance_orders_current`; agrega OS retornadas pela mesma API analítica por veículo.
- Mantidos manifestos, filtros de mapeamento, tipos SQL e demais recursos da V13.
