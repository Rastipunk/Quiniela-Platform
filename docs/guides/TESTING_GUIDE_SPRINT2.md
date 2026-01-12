# Guía de Testing - Sprint 2 (Advanced Pick Types System)

**Fecha:** 2026-01-11
**Alcance:** Testing de presets BASIC, ADVANCED, y preparación para CUSTOM

---

## 🎯 Objetivo del Testing

Verificar que el **Advanced Pick Types System** funciona end-to-end:
1. ✅ Wizard de configuración
2. ✅ Creación de pools con diferentes presets
3. ✅ Visualización de reglas en PoolPage
4. ✅ Sistema de picks con múltiples tipos
5. ⏳ Scoring avanzado por tipo de pick
6. ⏳ Leaderboard actualizado correctamente

---

## 📋 Pre-requisitos

### Backend Running
```bash
cd backend
npm run dev
```

### Frontend Running
```bash
cd frontend
npm run dev
```

### Usuarios de Prueba
- **HOST:** quiniela.host@example.com / Qn!Host2025_Aa1
- **PLAYER:** quiniela.player@example.com / Qn!Player2025_Aa1
- **ADMIN:** quiniela.admin@example.com / Qn!Admin2025_Aa1

---

## 🧪 Test Suite 1: Preset BASIC

### Test 1.1: Crear Pool con BASIC ✅

**Pasos:**
1. Login como HOST
2. Dashboard → "Crear Pool"
3. Seleccionar "WC 2026 Sandbox"
4. Nombre: "Test BASIC"
5. Click "🧙‍♂️ Asistente de Configuración"
6. Seleccionar preset "BASIC"
7. Verificar en resumen:
   - 6 fases mostradas
   - Fase de Grupos: 20 pts (marcador exacto)
   - Dieciseisavos: 30 pts
   - Octavos: 40 pts
   - Cuartos: 50 pts
   - Semis: 60 pts
   - Final: 70 pts
8. Click "Confirmar Configuración"
9. Click "Crear pool"

**Resultado Esperado:**
- Pool creada exitosamente
- Redirect a `/pools/:poolId`

### Test 1.2: Verificar Reglas en PoolPage

**Pasos:**
1. En PoolPage, ir a tab "Reglas"
2. Verificar que se muestra:
   - Banner morado con "📜 Reglas de Puntuación"
   - 6 fases con números del 1 al 6
   - Cada fase muestra:
     - Nombre (FASE DE GRUPOS, DIECISEISAVOS DE FINAL, etc.)
     - Tipo: "📝 Marcadores de partidos"
     - Puntos crecientes (20, 30, 40, 50, 60, 70)
     - Solo 1 tipo de pick: "Marcador exacto"
   - Notas al final

**Resultado Esperado:**
- Reglas claras y profesionales
- Auto-scaling visible (20 → 70 pts)

### Test 1.3: Hacer Picks como PLAYER

**Pasos:**
1. Copiar código de invitación del pool
2. Logout → Login como PLAYER
3. Dashboard → "Unirse a Pool"
4. Pegar código → "Unirme"
5. En PoolPage, ir a partidos
6. Seleccionar un partido de grupos
7. Ingresar marcador (ej: 2-1)
8. Click "Guardar Pick"

**Resultado Esperado:**
- Pick guardado exitosamente
- Mensaje de confirmación
- Al recargar, pick sigue ahí

---

## 🧪 Test Suite 2: Preset ADVANCED

### Test 2.1: Crear Pool con ADVANCED ✅

**Pasos:**
1. Login como HOST
2. Crear nuevo pool "Test ADVANCED"
3. Wizard → Preset "ADVANCED"
4. Verificar en resumen:
   - **Fase de Grupos (GROUP):**
     - 4 tipos de pick: Exacto (20), Diferencia (10), Parcial (8), Totales (5)
   - **Dieciseisavos (KNOCKOUT):**
     - 2 tipos: Exacto (30), Diferencia (15)
   - **Octavos (KNOCKOUT):**
     - 2 tipos: Exacto (40), Diferencia (20)
   - Y así sucesivamente...

**Resultado Esperado:**
- Grupos tienen 4 tipos (más opciones para acertar)
- Eliminatorias tienen 2 tipos (más difícil)
- Auto-scaling aplicado correctamente

### Test 2.2: Verificar Lógica Semántica (Fix que hicimos) ✅

**Verificación:**
- ❌ **ANTES (bug):** Cambio de reglas en index 3 (Cuartos)
- ✅ **AHORA (correcto):** Cambio de reglas cuando `phase.type === "GROUP"`

**Qué verificar:**
1. Fase de Grupos → 4 tipos ✅
2. Dieciseisavos → 2 tipos ✅ (NO 4 como antes)
3. Octavos → 2 tipos ✅ (NO 4 como antes)
4. Cuartos → 2 tipos ✅
5. Semis → 2 tipos ✅
6. Final → 2 tipos ✅

**Resultado Esperado:**
- La transición ocurre SEMÁNTICAMENTE (GROUP → KNOCKOUT)
- NO basada en posición arbitraria en el array

---

## 🧪 Test Suite 3: Preset CUSTOM (Opcional)

### Test 3.1: Configuración Manual por Fase

**Pasos:**
1. Wizard → Preset "CUSTOM"
2. Configurar manualmente:
   - Fase 1: Solo EXACT_SCORE (50 pts)
   - Fase 2: EXACT + DIFFERENCE (40 + 20)
   - Fase 3: Todos los tipos habilitados
3. Guardar y verificar resumen

**Resultado Esperado:**
- Configuración personalizada funciona
- Cada fase muestra lo configurado

---

## 🧪 Test Suite 4: Scoring Avanzado (CRÍTICO)

### Test 4.1: Verificar Scoring de EXACT_SCORE

**Setup:**
1. Pool ADVANCED
2. PLAYER hace pick: México 2-1 USA
3. HOST publica resultado: México 2-1 USA

**Verificación:**
```sql
SELECT * FROM "Prediction" WHERE "poolId" = '...' AND "userId" = '...';
-- pickJson debe ser: { "type": "SCORE", "homeGoals": 2, "awayGoals": 1 }
```

**Resultado Esperado en Leaderboard:**
- PLAYER gana 20 pts (marcador exacto en grupos)
- NO gana puntos de diferencia/parcial/totales (solo el más alto)

### Test 4.2: Verificar Scoring de GOAL_DIFFERENCE

**Setup:**
1. PLAYER hace pick: México 2-0 USA
2. HOST publica resultado: México 3-1 USA (diferencia +2)

**Resultado Esperado:**
- PLAYER gana 10 pts (diferencia correcta)
- NO marcador exacto (0 pts)

### Test 4.3: Verificar Scoring de PARTIAL_SCORE

**Setup:**
1. PLAYER hace pick: México 2-1 USA
2. HOST publica resultado: México 2-3 USA

**Resultado Esperado:**
- PLAYER gana 8 pts (acertó los 2 del local)
- NO exacto, NO diferencia

### Test 4.4: Verificar Scoring de TOTAL_GOALS

**Setup:**
1. PLAYER hace pick: México 2-1 USA (3 goles totales)
2. HOST publica resultado: México 3-0 USA (3 goles totales)

**Resultado Esperado:**
- PLAYER gana 5 pts (total de goles correcto)
- NO exacto, NO diferencia, NO parcial

### Test 4.5: Verificar Auto-Scaling en Eliminatorias

**Setup:**
1. Pool ADVANCED
2. Partido de FINAL
3. PLAYER acierta exacto

**Resultado Esperado:**
- PLAYER gana 70 pts (no 20 pts)
- Auto-scaling aplicado: basePoints = 20 + (5 * 10) = 70

---

## 🧪 Test Suite 5: Edge Cases

### Test 5.1: Deadline Enforcement

**Setup:**
1. Partido con kickoff en 5 minutos
2. Pool deadline = 10 minutos

**Verificación:**
- Pick UI debe mostrar "🔒 Pick cerrado"
- Botón "Guardar" debe estar disabled
- Intento de PUT debe devolver 409 DEADLINE_PASSED

### Test 5.2: Modificar Pick Antes de Deadline

**Pasos:**
1. Guardar pick: 2-1
2. Cambiar a: 3-0
3. Guardar nuevamente

**Resultado Esperado:**
- Pick actualizado a 3-0
- Solo cuenta el último guardado

### Test 5.3: Errata de Resultado

**Pasos:**
1. HOST publica: 2-1
2. HOST corrige a: 2-0 (con reason: "Error de captura")

**Verificación en DB:**
```sql
SELECT * FROM "PoolMatchResultVersion" WHERE "resultId" = '...';
-- Debe haber 2 versiones (1 y 2)
-- Version 2 debe tener reason
```

**Resultado Esperado:**
- Leaderboard se recalcula automáticamente
- Auditoría registra la errata

---

## 🧪 Test Suite 6: UX/UI Validation

### Test 6.1: Responsive Mobile

**Dispositivos a probar:**
- iPhone (375px width)
- Android (360px width)
- Tablet (768px width)

**Qué verificar:**
- Wizard se ve bien en mobile
- Cards de reglas se adaptan
- Inputs de picks son tocables

### Test 6.2: Accesibilidad

**Verificar:**
- Tab navigation funciona
- Labels claros en inputs
- Mensajes de error legibles
- Contraste de colores suficiente

---

## 📊 Checklist General

Antes de considerar Sprint 2 completo:

### Backend
- [x] Migración de Prisma aplicada
- [x] Endpoints de structural picks creados
- [x] Endpoints de structural results creados
- [x] Server arranca sin errores
- [ ] Scoring avanzado implementado
- [ ] Tests unitarios (opcional para MVP)

### Frontend
- [x] Wizard funcional (4 presets)
- [x] Preset BASIC genera config correcta
- [x] Preset ADVANCED con lógica semántica ✅
- [x] Preset SIMPLE genera config estructural
- [x] PickRulesDisplay renderiza todas las fases
- [ ] PoolPage integra pickers estructurales
- [ ] Leaderboard muestra puntos correctos

### Documentación
- [x] SIMPLE_PRESET_IMPLEMENTATION.md
- [x] TESTING_GUIDE_SPRINT2.md (este archivo)
- [ ] CHANGELOG actualizado
- [ ] DECISION_LOG con ADRs nuevos

---

## 🎯 Próximos Pasos Sugeridos

### Opción A: Testing Manual Completo
1. Ejecutar Test Suites 1-6 manualmente
2. Documentar bugs encontrados
3. Fijar scoring avanzado
4. Verificar leaderboard

### Opción B: Continuar con SIMPLE
1. Crear `StructuralPicksManager.tsx`
2. Integrar en PoolPage
3. Implementar scoring estructural
4. Testing end-to-end de SIMPLE

### Opción C: Pulir BASIC y ADVANCED
1. Mejorar UX de picks (modo lectura/edición)
2. Agregar loading states
3. Mejorar mensajes de error
4. Mobile optimization

---

## 📝 Notas de Testing

**Anota aquí los bugs encontrados:**

### Bugs Encontrados
- [ ] Bug #1: ...
- [ ] Bug #2: ...

### Features que funcionan perfecto
- [x] Wizard de configuración
- [x] Lógica semántica ADVANCED (phase.type)
- [x] PickRulesDisplay con estilo profesional
- [ ] ...

---

## ✅ Definition of Done - Sprint 2

Sprint 2 está completo cuando:

1. ✅ Wizard funcional con 4 presets
2. ✅ BASIC crea pools correctamente
3. ✅ ADVANCED usa lógica semántica (no hardcoded)
4. ⏳ SIMPLE tiene componentes UI listos (90%)
5. ⏳ Scoring avanzado funciona para todos los tipos
6. ⏳ Leaderboard refleja puntos correctos
7. ⏳ Testing manual completo (Suites 1-6)
8. ⏳ Documentación actualizada

**Progreso actual:** 4/8 (50%) ✅

---

**Creado por:** Claude Sonnet 4.5
**Última actualización:** 2026-01-11
