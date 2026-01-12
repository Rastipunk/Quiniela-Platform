# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [Unreleased]

### Pendiente
- Rate Limiting y protección contra brute-force
- Mobile UX improvements
- Email confirmation en registro
- Chat del pool

---

## [0.2.0] - 2026-01-12

### Sprint 2 - Advanced Features

#### Added
- **Advanced Pick Types System**
  - GROUP_STANDINGS: Predecir posiciones de grupos
  - KNOCKOUT_WINNER: Predecir quién avanza en eliminatorias
  - SIMPLE preset con configuración automática por fase
  - Configuración personalizada (CUSTOM preset) con wizard
  - Scoring diferenciado por tipo de pick

- **Pool State Machine**
  - Estados: DRAFT → ACTIVE → COMPLETED → ARCHIVED
  - Transiciones automáticas basadas en eventos
  - Validaciones por estado (joins, picks, results)

- **Co-Admin System**
  - Rol CO_ADMIN con permisos delegados
  - Endpoints: promote, demote
  - Auditoría completa de acciones

- **Join Approval Workflow**
  - Pool puede requerir aprobación para unirse
  - Endpoints: approve, reject pending members
  - Estado PENDING para solicitudes

- **User Profile**
  - Página de perfil con estadísticas
  - Configuración de timezone por usuario
  - Edición de displayName

- **Fixture Snapshot System**
  - Pool mantiene copia independiente del fixture
  - Equipos resueltos tras avance de fase
  - Integridad de datos por pool

#### Changed
- Login soporta Google OAuth
- Registro incluye username único
- Password recovery via email (Resend)

#### Technical
- 13 migraciones de base de datos
- Nuevo sistema de scoring estructural
- Validación de picks por fase y tipo

---

## [0.1.0] - 2026-01-04

### Sprint 1 - MVP Core

#### Added
- **Sistema de Username** (ADR-024)
  - Campo único e inmutable
  - Validación: 3-20 chars, alphanumeric
  - Reserved words bloqueadas

- **Google OAuth** (ADR-026)
  - Login/Register con Google
  - Integración con google-auth-library

- **Password Recovery** (ADR-025)
  - Forgot password flow
  - Email con Resend
  - Tokens de reset seguros

- **Tournament Advancement System** (ADR-019 a 023)
  - Auto-avance de grupos a eliminatorias
  - Validación de fase completa
  - Resolución de equipos por posición

#### Core Features
- Registro/Login (email/password)
- Dashboard con pools del usuario
- Crear pool con código de invitación
- Unirse a pool por código
- Ver partidos por grupo/fase
- Guardar/modificar picks antes de deadline
- Publicar resultados (HOST)
- Leaderboard con scoring configurable
- Hardening: token expirado → logout

---

## [0.0.1] - 2026-01-02

### Initial Setup
- Monorepo structure (backend + frontend)
- PostgreSQL + Prisma ORM
- Express + TypeScript backend
- React + Vite frontend
- JWT authentication
- Source of Truth documentation in /docs/sot/
