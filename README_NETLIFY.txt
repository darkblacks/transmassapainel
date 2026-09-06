TRANSMASSA PAINEL — FRONTEND V7.7 MOTION

Pronto para GitHub + Netlify.

Produção:
VITE_API_URL=/backend

netlify.toml já configurado:
- npm run build
- publish dist
- /backend/* -> AWS:8080
- fallback SPA

Motion:
- entrada do cabeçalho
- cards KPI com spring
- linhas entrando/saindo
- expansão da seta animada
- login animado
- status Em movimento pulsando
- barra de capacidade com transição
- hover e microinterações

Mantidas as cores e a logo Transmassa.

Git:
git add .
git commit -m "frontend v7.7 motion"
git push
