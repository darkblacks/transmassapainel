# V14.1

- Remove N+1 da página /historico-os.
- Página consulta um único endpoint agregado: GET /api/fleet-insights/service-orders?months=24.
- Drawer continua usando GET /api/fleet-insights/vehicle/:plate.
- Sem fallback local/mock.
- Se a API retornar zero, o front mostra zero.
