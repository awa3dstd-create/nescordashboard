# Ingeniería Nescor Dashboard — Espejo GitHub Pages

Espejo estático (Espejo 3) del dashboard de KPIs de Ingeniería Nescor.

- **URL del espejo:** https://awa3dstd-create.github.io/nescordashboard/
- **Producción:** https://nescor-dashboard.pages.dev/dashboard/
- **Espejo 1 (Cloudflare Pages):** https://nescor-dashboard-mirror.pages.dev/dashboard/
- **Espejo 2 (Worker):** https://nescor-mirror.dashiellyeneri.workers.dev/dashboard/

Los 4 accesos comparten la MISMA base de datos (KV) y la misma sesión: un
usuario puede entrar por cualquiera de ellos. Si un servidor se satura, el
propio HTML rota automáticamente al siguiente (failover integrado, v2.17.0).

## Actualizar este espejo tras un nuevo deploy de producción

1. Copiar el contenido de `github-pages-kit/dashboard/` del nuevo kit en la
   raíz de este repo (este `README.md` y `.nojekyll` permanecen).
2. `git add -A && git commit -m "sync vX.Y.Z" && git push`

Publica este repo quien gestione el proyecto (con token o desde la web de
GitHub: *Add file → Upload files*).
