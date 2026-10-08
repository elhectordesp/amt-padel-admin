@AGENTS.md

# CLAUDE.md — amt-padel-admin

Panel de administración de AMT Padel: Next.js 16 + React 19 + TanStack Query + Tailwind 4, desplegado en Vercel. Consume la API de `../amt-padel-app-back` (NestJS); la app móvil es `../amt-padel-app` (Expo). Proyecto de una sola persona (Héctor). Responde en español.

⚠️ **Este repo es PÚBLICO.** Todo lo que se commitea (código, docs, comentarios, mensajes de commit y de PR) lo puede leer cualquiera: nada de secretos, hosts o ids de infraestructura, ni datos de jugadores o clientes.

Estas reglas mandan sobre el comportamiento por defecto y están ordenadas por prioridad: ante un conflicto, gana la de número menor.

## 1. Reglas críticas

1. **Producción no se toca sin orden explícita.** Nada de redespliegues manuales, cambios de variables en Vercel ni commits vacíos para forzar un deploy si el usuario no lo pide en ese momento.
2. **Ningún secreto fuera de su sitio:** ni en comandos, ni en ficheros versionados, ni en permisos de Claude Code, ni en logs, ni en respuestas. Viven en `.env.local` (ignorado) o en `~/.amt/` (fuera de los repos) y se referencian por nombre de variable. Nunca mostrar una línea que contenga un secreto, tampoco "enmascarada" con regex: comprobar con recuentos. Si alguien pega una credencial en el chat: parar, no usarla y pedir que la rote.
   - *Cicatriz (2026-10-08):* `.claude/settings.local.json` estaba versionado y su copia local había acumulado comandos con credenciales de producción; en este repo público un `git add -A` las habría publicado. Ese fichero ya está fuera de git: no volver a añadirlo.
3. **Evidencia antes que afirmación.** No decir "hecho", "listo", "funciona" ni "arreglado" sin haber ejecutado en esta sesión el comando que lo demuestra, citando su resultado. Lenguaje calibrado:
   - **Cerrado:** verificado hoy, con evidencia.
   - **Hecho, falta verificar X:** el código está, pero falta un paso (nombrarlo; por ejemplo, la prueba en la preview de Vercel).
   - **Pendiente:** no empezado o bloqueado (decir por qué).
   Si un test falla o un paso se salta, decirlo con la salida.
4. **Calidad profesional, sin atajos.** Nada de parches temporales, datos falsos en pantallas reales, `TODO: luego`, `any`/`as any` para callar al compilador, `eslint-disable`, tests desactivados ni `--no-verify`. Los bugs se arreglan en la causa raíz, no en el síntoma.
   **Contrato anti-chapuza:** antes de implementar una solución técnica no trivial, escribir en la respuesta:
   1. Alternativas consideradas.
   2. La elegida, por qué es la más robusta y qué cuesta (trade-off).
   3. Bandera roja: si la elegida es un atajo, PARAR y preguntar en vez de implementar.
5. **Leer antes de escribir.** Antes de modificar un fichero, leerlo entero si tiene menos de 1.500 líneas; si es mayor, las secciones afectadas y todos los usos (grep) de cada símbolo que se cambia. Comprobar que el cambio no rompe otras pantallas. El código se edita con el editor, nunca con `sed`, heredocs o scripts que reescriben ficheros.
6. **Pensar antes de implementar.** Análisis a fondo incluso en cambios pequeños. En cambios grandes, plan por escrito y aprobación antes de tocar código.

## 2. Flujo de trabajo

- **Camino único:** rama → commits → push → PR → CI verde → `/code-review` si aplica → merge (lo decide el usuario) → Vercel despliega. Nunca commit directo a `main`.
- **Ramas** desde `origin/main` actualizado: `feat/`, `fix/`, `chore/`, `refactor/`, `test/` o `docs/` + descripción en kebab-case.
- **Commits:** Conventional Commits en español y minúsculas, `tipo(ámbito): descripción`. El cuerpo explica el porqué y acaba con la verificación (p. ej. `tsc limpio, build OK, 204 tests verdes`). PRs con secciones Qué / Por qué / Verificación; se mergean con squash.
- **`/code-review` obligatorio antes de mergear** si el PR toca auth o permisos (`middleware.ts`, `lib/auth.ts`, `lib/api.ts`), dinero (finanzas, precios, pagos), código compartido entre pantallas (`lib/`, `components/admin/form`, tipos) o el contrato con el back. Opcional en cambios solo visuales de una pantalla.
- **Antes de un cambio grande**, commit del estado actual en la rama para poder volver.
- **Trabajo a medias de otra tarea:** no mezclarlo; usar `git worktree`.
- Commit, push y PR solo dentro de una tarea autorizada por el usuario.

## 3. Despliegue

- **Vercel (integración con GitHub):** merge a `main` → producción en `https://admin.amtpadel.com`; cada PR → preview. No hay `vercel.json`.
- **`main` protegida** (ruleset): PR obligatorio y checks `Lint & Test` y `Build check` de `.github/workflows/ci.yml` en verde. Playwright no corre en el CI.
- **URLs públicas que no se pueden romper:** `/torneo/[id]` (visor) y `/torneo/[id]/live`, `/player/[id]`, `/ranking`, `/privacidad` y `/ayuda` (las URLs de privacidad y soporte de la ficha de la App Store), `/eliminar-cuenta` y `/aceptar-invitacion`. Cambiar una de estas rutas rompe enlaces ya compartidos.
- **Variables:** `NEXT_PUBLIC_API_URL` (API del back), `NEXT_PUBLIC_BASE_URL` (la usa el widget `live`), las de Sentry (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`). Plantilla en `.env.local.example` (también ignorado por git).

## 4. Comandos

| Para | Comando |
|---|---|
| Arrancar (el back ocupa el 3000) | `npx next dev --port 3001` |
| Tests unitarios (Vitest) | `npm test` |
| Un test | `npx vitest run src/__tests__/lib/csv.test.ts -t "nombre"` |
| Tipos | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| E2E (Playwright, API mockeada) | `npm run test:e2e` |

**Mínimo antes de decir "hecho":** `tsc` + `npm test` + `npm run lint`; si se tocan rutas, config o páginas públicas, también `npm run build`. Si el cambio se ve en pantalla, decir qué hay que comprobar en la preview de Vercel.

## 5. Convenciones y trampas

- **Next 16 (ver `AGENTS.md`):** leer la guía de `node_modules/next/dist/docs/` antes de usar una API de Next. `params` y `searchParams` son Promise y se hace `await`. `middleware.ts` es una convención obsoleta en Next 16 (ahora `proxy.ts`): no migrarlo de paso, solo como tarea propia.
- **Datos:** `lib/api.ts` (axios) desenvuelve `{ data }` y renueva el token en un 401. Servicios en `lib/services/`. Lecturas y escrituras con TanStack Query, con las query keys en factorías (como `bookingsQK`). Avisos con `sonner`. Las páginas públicas SSR usan `fetch` directo.
- **Convención "Confirma para…":** si el back devuelve un error que contiene "Confirma para", la UI pide confirmación y reintenta con `force: true`. Respetarla en las acciones nuevas que el back proteja así.
- **Fechas:** nunca `toISOString().slice(0, 10)` para sacar el día local (cerca de medianoche da el día anterior en Madrid); usar `localDayKey()` de `lib/utils/date-keys.ts`. Quedan usos antiguos de ese patrón: no copiarlos. `formatDateRange` usa UTC a propósito (fechas de calendario guardadas). `Match.date` no tiene zona y se pinta con la hora del navegador.
- **Roles:** ADMIN y CLUB usan el panel. `middleware.ts` solo redirige; la seguridad real está en el back. Trampa conocida: `PUBLIC_PATHS` compara con `startsWith`, y `"/torneo"` también deja pasar `/torneos`.
- **Género:** el género de la persona y el de la categoría (abierta, femenina, mixta) son cosas distintas: no reutilizar un tipo para el otro.
- **Fichero enorme:** `app/(admin)/torneos/[id]/page.tsx` (~4.400 líneas). Las piezas nuevas van en componentes propios dentro de `components/admin/`.
- **UI:** todo el texto en español (no hay i18n), tema oscuro y dorado `#D4AF37`. Formularios nuevos con react-hook-form + zod.
- **Tests:** en `src/__tests__/`, mockeando `lib/api`.

## 6. Datos sensibles

- **Datos personales de jugadores (RGPD):** nombre, email, teléfono, género, ciudad, foto y nivel, incluidas las fichas que crea el admin sin que el jugador se registre. Nunca copiarlos de producción a tests, fixtures, capturas, issues, commits ni respuestas: usar datos inventados.
- **Menores:** hoy no se guarda la fecha de nacimiento. Si llegan Escuela/Clases o categorías Junior, avisar antes de diseñar: hará falta el consentimiento del tutor.
- **Pagos:** no se manejan tarjetas, IBAN ni DNI.

## 7. Contexto del proyecto

- **AMT Padel:** plataforma de un circuito de torneos de pádel. Este panel lo usan los administradores de AMT y los de cada club. Secciones: torneos (wizard de creación, categorías, cuadros, horarios, resultados), inscripciones, jugadores, rankings, estadísticas, finanzas, clubes, patrocinadores, soporte, historial y "Mi club" con el módulo de reservas de pistas (en pruebas).
- **Contrato con el back:** un cambio de endpoint se hace primero en el back; aquí se adaptan los tipos (`types/`) y los servicios (`lib/services/`).
