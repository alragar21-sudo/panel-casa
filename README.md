# Panel de casa

Cuadrante de limpieza, gastos (tipo Tricount), lista de compras e ideas para la casa.
Se puede instalar en el móvil ("Añadir a pantalla de inicio") y funciona sin cuentas.

## Publicar en Vercel

1. Vercel → Add New → Project → importar este repositorio (preset "Other", sin build).
2. En el proyecto: Storage → crear una base de datos **Upstash Redis** y conectarla al proyecto.
   Vercel añade solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Redeploy. Sin base de datos la app funciona igual, pero guarda solo en cada móvil.

## Estructura

- `index.html` – la app (calendario, gastos, compras, ideas).
- `sync.js` – sincroniza con `/api/data` cada pocos segundos.
- `api/data.js` – función de Vercel que guarda los datos en Redis.
- `sw.js`, `manifest.webmanifest`, `icons/` – lo necesario para instalarla como app.
