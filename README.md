# Panel de casa

Cuadrante de limpieza, gastos (tipo Tricount), lista de compras e ideas para la casa.
Se puede instalar en el móvil ("Añadir a pantalla de inicio") y funciona sin cuentas.

## Publicar en Vercel

1. Vercel → Add New → Project → importar este repositorio (preset "Other", sin build).
2. En el proyecto: Storage → crear una base de datos (**Neon Postgres** o **Upstash Redis**) y conectarla al proyecto.
   Vercel añade solo las variables (`DATABASE_URL` o `KV_REST_API_URL`). La app crea sus tablas sola.
3. Redeploy. Sin base de datos la app funciona igual, pero guarda solo en cada móvil.

## Entrar

Al abrir la app, cada una elige su nombre y pone el código de la casa.
La primera persona que entra crea el código (4 a 8 números) y luego se lo pasa a las demás.
Todo lo que se marca o se apunta se guarda con el nombre de quien lo hizo.

## Estructura

- `index.html` – la app (calendario, gastos, compras, ideas).
- `login.js` – pantalla de entrada (nombre + código de la casa).
- `sync.js` – sincroniza con `/api/data` cada pocos segundos.
- `api/data.js` – función de Vercel que guarda los datos en Redis (pide el código).
- `api/login.js` – crea y comprueba el código de la casa.
- `sw.js`, `manifest.webmanifest`, `icons/` – lo necesario para instalarla como app.
