# QA de Despliegue — `feature/reservas-sprint1` → `main`

> Checklist exhaustiva para el despliegue grande (backend `amt-padel-app-back` + admin `amt-padel-admin`).
> Cubre **overhaul de torneos/cuadros**, **omnipotencia del admin** y el **módulo Reservas (admin)**.
> Incluye casos que DEBEN funcionar (✅) y casos que DEBEN fallar / pedir confirmación (⛔).

**Leyenda:** `[ ]` pendiente · `[x]` OK · `[!]` falla (anota abajo).
`✅` = debe pasar · `⛔` = debe bloquear/avisar (si NO bloquea, es un bug) · `🔁` = regresión (lo viejo sigue igual).

**Convención clave del proyecto:** los errores *forzables* del backend contienen el texto **"Confirma para…"**, y el admin ofrece reintentar con `force` tras un `window.confirm`. Cada caso ⛔ de omnipotencia debe: (1) bloquear swithout force, (2) mostrar el confirm, (3) aplicar al confirmar.

---

## 0. Contenido del despliegue (referencia)

**Backend — migraciones nuevas (todas aditivas, no destructivas):**
- `20260624103314_reservas_sprint1` — tablas del módulo Reservas.
- `20260624131208_reservas_club_booking_public_at`.
- `20260628120000_add_r32_match_phase` — valor `R32` en enum `MatchPhase`.
- `20260630000000_add_bracket_progression` — columnas `nextMatchId`, `nextSlot`, `bracketPos` en `Match`.

**Cambio de comportamiento crítico:** el avance de cuadro pasa de "por fases" (main) a **determinista por `nextMatchId`**. Los torneos creados ANTES del deploy no tienen esas columnas → ver §E4 y §Regresión.

---

## 1. PRE-DESPLIEGUE

- [ ] El torneo del amigo (finales) ha **terminado** (no desplegar en vivo). Ver `[[proyecto_eliminatorias_torneo_amigo]]`.
- [ ] **Backup `pg_dump` de prod tomado y guardado** (con fecha/hora). Comando de referencia:
      `pg_dump "$PROD_DB_URL" -Fc -f backup_pre_deploy_YYYYMMDD_HHMM.dump`
- [ ] **Verificado que el backup restaura** en una BD desechable (no confiar a ciegas).
- [ ] `git status` limpio en ambos repos; rama `feature/reservas-sprint1` al día.
- [ ] Suite de tests backend en verde (`npm test`) — ~854 tests.
- [ ] Typecheck/lint OK en backend y admin.
- [ ] Revisadas las migraciones: `npx prisma migrate diff` / `migrate status` contra prod → solo las 4 aditivas pendientes.
- [ ] Anotado el commit actual de `main` en ambos repos (para rollback de código).

---

## 2. DESPLIEGUE (orden)

- [ ] Merge `feature/reservas-sprint1` → `main` en **backend**.
- [ ] Merge `feature/reservas-sprint1` → `main` en **admin**.
- [ ] **Migraciones en prod** (`prisma migrate deploy`) — deben aplicarse las 4 sin error.
- [ ] Deploy backend (Railway) OK — el servicio arranca sin crashear.
- [ ] Deploy admin (Vercel) OK — build sin errores.
- [ ] (Si aplica) Deploy app móvil / OTA — **Reservas sigue oculto** por feature flag (`EXPO_PUBLIC_RESERVAS_ENABLED=false`).

---

## 3. SMOKE POST-DESPLIEGUE (5 min, que "arranca todo")

- [ ] ✅ Login admin OK.
- [ ] ✅ Listado de torneos carga.
- [ ] ✅ Abrir un torneo existente (creado ANTES del deploy) → detalle carga sin error (pestañas Cuadro/Grupos/Calendario/Config).
- [ ] ✅ Visor público de un torneo carga (cuadro + grupos visibles).
- [ ] ✅ App móvil arranca, home/torneos cargan, **sin** entrada a Reservas.
- [ ] ✅ Meter un resultado de prueba en un torneo de test → guarda y recalcula.

---

## 4. QA DETALLADO

### A. Generación de cuadro (algoritmo + opciones)
- [ ] ✅ Generar cuadro desde grupos con **clasificación estándar** (2 por grupo).
- [ ] ✅ **topN configurable** (1º de cada grupo / 1-4) respeta el número.
- [ ] ✅ **Comodines / `extraQualifiers`** (mejores terceros): con N comodines entran N parejas extra y el cuadro cuadra (byes correctos).
- [ ] ✅ Grupos **desiguales** (p.ej. 4,4,3): reparto y byes correctos; el grupo de 5 es intencional.
- [ ] ✅ Cuadros de **17–32 parejas** → fase **R32** aparece y se genera bien.
- [ ] ✅ **Separación de mismo grupo** en la siembra (dos del mismo grupo no se cruzan antes de lo debido).
- [ ] ✅ **Consolación** se crea en el camino grupos→eliminatoria (D2).
- [ ] ✅ **Preview** del cuadro refleja las opciones antes de confirmar.
- [ ] ⛔ Regenerar la eliminatoria con elim **ya empezada** → pide "Confirma para…" (P7).
- [ ] 🔁 El checkbox muerto de "seeding LSPA" **ya no aparece** (P2).

### B. Cruce manual de eliminatoria (Frente 3)
- [ ] ✅ Editor de cruce manual permite definir 1ºA vs 2ºC, etc.
- [ ] ✅ El cuadro generado respeta EXACTAMENTE el cruce definido.
- [ ] ✅ Combinación manual + comodines coherente.
- [ ] ⛔ Cruce inválido (pareja repetida / hueco sin asignar) → error claro.

### C. Edición manual de partidos
- [ ] ✅ **Crear partido a mano** (createManualMatch) con pareja/fecha/pista.
- [ ] ✅ **Editar parejas** de un partido ya creado (editMatchPlayers) (P6/P13) — caso Pablo→Pep.
- [ ] ✅ El match de pareja funciona contra ambos lados (userId **y** partnerId).
- [ ] ✅ **Borrar partido** desde el calendario.
- [ ] ⛔ Editar parejas de un partido **FINISHED** → pide "Confirma para…" (P6).
- [ ] ⛔ En partido de **grupo**, cambiar jugadores → avisa que NO recalcula `GroupMember` (o lo recalcula), no lo hace en silencio.

### D. Grupos (montaje)
- [ ] ✅ **Renombrar** grupo a mano (Frente 2).
- [ ] ✅ **Añadir / borrar** grupo individual; re-letterizado correcto.
- [ ] ✅ **Reestructurar grupos** (endpoint atómico) preserva horarios (H3).
- [ ] ✅ **Reparto global** de miembros (updateAllGroupMembers) atómico, con modo edición + guardado global.
- [ ] ✅ **Override manual de stats** de pareja (P11): fijar puntos/sets/juegos; **puntos admite negativos** (sanciones).
- [ ] ⛔ `updateGroupMembers` que borraría resultados en silencio → guard/aviso (P9-relacionado / #9).
- [ ] ⛔ `deleteGroup` de un grupo con partidos FINISHED → pide "Confirma para…" (P7).

### E. Resultados y avance
- [ ] ✅ Meter resultado con sistema **3/0** (ganador 3 pts, perdedor 0).
- [ ] ✅ **Validación estricta de marcador** (sets coherentes; super-tie según formato de la ronda).
- [ ] ✅ Ganador **derivado de los sets** (no manual) — #5.
- [ ] ✅ Meter resultados **desde la pestaña Cuadro** (no solo Calendario) (mejora QA #1).
- [ ] ✅ **E4 — Avance determinista:** al completar una ronda, el ganador sube al `nextMatchId`/`nextSlot` correcto; al completar la fase, sube `currentPhase`.
- [ ] ✅ **Re-editar** un resultado NO produce doble-conteo de stats (#4) ni descuadra la clasificación (fix revert 3/0).
- [ ] ✅ Corregir 1ª ronda elim reescribe al perdedor en la **consolación** correctamente.
- [ ] ✅ **Walkover (W.O.)**: registrar desde UI dedicada; estado y desempate neutro correctos.
- [ ] ✅ No se puntúa una pareja **"Por definir"** (mejora QA #2).
- [ ] ⛔ Marcador inválido (p.ej. 6-6 sin tie, sets de más) → rechazado.
- [ ] ⛔ Corregir resultado elim si la **ronda siguiente ya se jugó** → "Confirma para…" (P8).

### F. Standings / desempates
- [ ] ✅ Desempate **FIPP completo** con mini-liga entre empatados (A1).
- [ ] ✅ Desempate justo entre **grupos desiguales**; W.O. cuenta neutro.
- [ ] ✅ Orden **numérico** de categorías correcto (#8) (1ª, 2ª, …, 10ª).

### G. Omnipotencia / `force` (todos los guards)
> Para cada uno: sin force **debe bloquear con "Confirma para…"**; con confirm **debe aplicar**.
- [ ] ⛔→✅ **P4** — meter/corregir resultado con torneo **FINISHED o sin arrancar** (no ONGOING).
- [ ] ⛔→✅ **P5** — **reabrir torneo** (FINISHED→ONGOING) y editar torneo cerrado.
- [ ] ⛔→✅ **P8** — corregir elim con ronda siguiente jugada.
- [ ] ⛔→✅ **P9** — reducir plazas de categoría por debajo de parejas confirmadas.
- [ ] ⛔→✅ **P7** — swap parejas / regenerar elim / borrar grupo en estado FINISHED.
- [ ] ⛔→✅ **P6** — editar parejas de partido FINISHED.
- [ ] ⛔→✅ **P19** — borrar categoría/torneo con partidos (cascada).

### H. Reabrir / des-finalizar partido (P10)
- [ ] ✅ Botón **"Reabrir"** en un partido jugado → vuelve a SCHEDULED **sin resultado**.
- [ ] ✅ **Revierte stats de grupo** exactamente (−3/−0), coherente con la clasificación.
- [ ] ✅ Retira al ganador del hueco del siguiente partido de elim (limpia avance).
- [ ] ⛔ Reabrir con la **ronda siguiente ya jugada** → "Confirma para…".
- [ ] ⛔ Reabrir un partido **no FINISHED** → error `MATCH_NOT_FINISHED`.

### I. Estado del torneo / correcciones con torneo cerrado
- [ ] ✅ Cambiar estado del torneo por el `<select>` con diálogo de confirmación.
- [ ] ✅ Tras reabrir (P5), corregir un resultado (P4) recalcula campeón/clasificación.

### J. Horarios / publicación / árbitro
- [ ] ✅ **Editar jornadas y tramos** durante el montaje (Frente 1).
- [ ] ✅ Auto-programación respeta partidos **fijos** (con fecha+pista) y solo asigna los que faltan.
- [ ] ✅ **Publicar por categoría** oculta/expone la agenda al jugador.
- [ ] ✅ **"Publicar todo"** el torneo de golpe (P18).
- [ ] ✅ **Árbitro por partido** (P14): asignar y limpiar `referee`.
- [ ] ✅ **Calendario ordenado por rondas** (mejora QA #2).

### K. Borrar categoría / torneo (P19)
- [ ] ⛔→✅ Borrar **categoría** con partidos → confirm-retry → cascada limpia (sin FK huérfanas).
- [ ] ⛔→✅ Borrar **torneo** (soft-delete) con force.
- [ ] 🔁 Cambiar `gender`/`level` de categoría **sigue prohibido** (por diseño).

### L. Reservas (módulo admin nuevo)
- [ ] ✅ Foundation Reservas carga (Fase 3.A) sin romper el resto del admin.
- [ ] ✅ Las **8 páginas de configuración** de Reservas cargan (Fase 3.B).
- [ ] ✅ Página de **Horarios + Excepciones** funciona (3.B.1).
- [ ] ✅ Reserva de club (booking) — flujo básico admin.
- [ ] 🔁 **La app móvil NO muestra Reservas** (feature flag) — confirmado.
- [ ] ✅ Los endpoints/tablas de Reservas no afectan a torneos.

### M. Visor público
- [ ] ✅ Cuadro y grupos **visibles** aunque la categoría no esté publicada (decisión P17: dejar visible).
- [ ] ✅ Publicar solo afecta a la **agenda del jugador**, no oculta la estructura.
- [ ] ✅ Fechas/pistas de partidos fijos se muestran correctas (zona horaria Madrid).

---

## 5. REGRESIÓN (lo de antes sigue OK)

- [ ] 🔁 Un torneo **creado antes del deploy** (sin `nextMatchId`): meter un resultado NO crashea. **Verificar cómo avanza** — si el motor nuevo depende de `nextMatchId` y está null, documentar el comportamiento (¿re-generar cuadro para cablear el árbol? ¿fallback?). **CASO DE RIESGO PRINCIPAL.**
- [ ] 🔁 Perfil de jugador, historial, valoraciones (si existen) cargan.
- [ ] 🔁 Login, roles (ADMIN/CLUB/APP_MANAGER), permisos scoping por club.
- [ ] 🔁 Notificaciones push no se disparan de más.
- [ ] 🔁 Historial de auditoría `/historial` con filtros (P3).

---

## 6. ROLLBACK (si algo rompe)

1. **Revertir código:** re-desplegar el commit de `main` anterior anotado (backend Railway + admin Vercel).
2. **Restaurar datos:** `pg_restore` del `pg_dump` pre-deploy sobre prod.
   `pg_restore --clean --if-exists -d "$PROD_DB_URL" backup_pre_deploy_*.dump`
3. Como las migraciones son **aditivas**, el `main` viejo funciona contra el esquema nuevo (ignora columnas/tablas extra) — pero para un rollback limpio, restaurar el dump devuelve el esquema al estado pre-deploy y casa con el código viejo.
4. Verificar smoke (§3) tras el rollback.

> ⚠️ El punto delicado del rollback es que las columnas `nextMatchId` etc. las escribe el código nuevo; si se restaura el dump pre-deploy, esos datos desaparecen (esperado). Confirmar que el `main` viejo no las necesita.

---

### Anotaciones de la ejecución
_(fecha, quién, incidencias encontradas, con qué caso)_

-
