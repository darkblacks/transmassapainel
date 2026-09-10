# Transmassa Painel V17

- Nova pré-tela em tela cheia com as filiais RJ, SP e RB.
- Pré-painel em formato TV: cada filial ocupa uma linha lateral grande.
- Cada filial mostra seis cards padronizados: total, disponíveis, coleta, distribuição/lotação, transferência e manutenção.
- A pré-tela considera somente veículos próprios; terceiros não entram nos totais nem nos serviços dessa visão.
- Ao abrir uma filial pelo pré-painel, o painel detalhado já entra filtrado como `Próprio`.
- O gráfico pequeno foi removido para melhorar leitura à distância.
- O topo fica totalmente fora da visão para não cobrir as filiais.
- A barra superior desce com movimento quando o mouse encosta no topo da tela e some ao tirar o mouse.
- Os cards usam as imagens oficiais de filial para RB, SP e RJ no lugar das siglas em bloco.
- O total foi padronizado no mesmo componente visual dos demais indicadores.
- As 3 filiais e um espaço reservado para filial futura foram ajustados para caber na altura da tela em formato de TV.
- Clique na filial abre o painel detalhado existente com o filtro aplicado.
- SP reconhece os códigos `SP` e `SBC`; RB reconhece `RB` e `RP`.
- Status `Empenhado` passa a ser exibido como `Contratado`.
- Distribuição passa a ser exibida como `Distribuição/Lotação`.
- Hierarquia aplicada por manifesto: `Distribuição/Lotação` prevalece sobre `Transferência`, que prevalece sobre `Coleta`.
- A tela de configuração alterada é somente `Grupos de frota`.
- O painel continua consumindo as informações automáticas do sistema, mas o grupo pode sobrepor manualmente filial, motorista, tipo, serviço e observação quando o dado automático estiver errado.
- Os endpoints atuais foram preservados; a sobreposição de serviço usa o mesmo endpoint de salvar placa e precisa apenas da coluna `service_override`.
- Migração opcional para essa coluna: `fleet-collector/db/migrations/003_fleet_mapping_service_override.sql`.

## Teste local

Para rodar o front local apontando para o backend da AWS, abra primeiro um túnel SSH no Windows:

```bat
ssh -i ".\orvya-key.pem" -L 8080:127.0.0.1:8080 ubuntu@52.67.144.140
```

Deixe essa janela aberta. Em outra janela, rode o front:

```bat
npm install
npm run dev
```

O Vite usa `http://127.0.0.1:8080` como proxy local.
