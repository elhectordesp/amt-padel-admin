# AMT Padel — Panel Admin

Panel de administracion del circuito AMT Padel. Next.js 16 + App Router + Tailwind CSS v4.

## Requisitos

- Node.js 20+
- npm 10+

## Arranque en local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar NEXT_PUBLIC_API_URL con la URL del backend

# 3. Arrancar en modo desarrollo
npm run dev
```

Panel disponible en `http://localhost:3001`

## Variables de entorno

| Variable | Descripcion |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL del backend (ej: `http://localhost:3000/api`) |
| `SENTRY_DSN` | DSN de Sentry (opcional, solo produccion) |
| `SENTRY_AUTH_TOKEN` | Token para subir source maps a Sentry en CI |

## Scripts

```bash
npm run dev      # Desarrollo con hot reload
npm run build    # Build de produccion
npm run start    # Servidor de produccion (requiere build previo)
npm run lint     # ESLint
npx tsc --noEmit # Verificar tipos TypeScript
npm run test     # Tests (Vitest)
```

## Estructura del proyecto

```
app/
  (admin)/       Rutas protegidas del panel admin
    dashboard/   Dashboard con estadisticas y alertas
    torneos/     Gestion de torneos (lista, detalle, wizard de creacion)
    inscripciones/ Gestion de inscripciones por torneo
    resultados/  Introduccion de resultados de partidos
    jugadores/   Gestion de jugadores (nivel, historial)
    rankings/    Rankings SPA y de circuito
    finanzas/    Estadisticas financieras
    configuracion/ Configuracion del sistema SPA
  player/[id]/   Perfil publico de jugador (sin auth)
  torneo/[id]/   Modo espectador del cuadro (sin auth)
  login/         Pagina de login
components/
  admin/         Componentes del panel (Header, Sidebar, ConfirmModal, etc.)
lib/
  api.ts         Cliente axios con interceptores (refresh token, unwrap response)
  auth.ts        Login, logout, verificacion de rol en servidor
  constants.ts   Labels y colores de categorias, tiers, estados
  services/
    admin.ts     Todos los metodos de la API del admin
  utils/
    csv.ts       Utilidad downloadCsv reutilizable
middleware.ts    Proteccion de rutas: redirige a /login si no hay token
types/
  index.ts       Tipos TypeScript compartidos
```

## Acceso

Solo usuarios con `role: ADMIN` en el backend pueden acceder.
El login verifica el rol directamente desde el payload del JWT (`role === 'admin'`) — no hace una llamada extra al servidor para ello.

## Paginas publicas

- `/player/:id` — Perfil publico de jugador (SSR, revalidacion 5min)
- `/torneo/:id` — Modo espectador del cuadro con grupos y resultados (SSR, revalidacion 30s)
