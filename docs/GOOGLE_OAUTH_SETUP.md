# Google OAuth Setup Guide

Esta guía explica cómo configurar Google OAuth para permitir que los usuarios inicien sesión con su cuenta de Google.

## 📋 Requisitos Previos

- Una cuenta de Google (gmail)
- Acceso a [Google Cloud Console](https://console.cloud.google.com/)

---

## 🚀 Pasos de Configuración

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Haz clic en el selector de proyectos (parte superior izquierda)
3. Haz clic en **"Nuevo proyecto"**
4. Nombre sugerido: `Quiniela Platform` (o el que prefieras)
5. Haz clic en **"Crear"**
6. Espera a que se cree el proyecto y selecciónalo

### 2. Habilitar Google+ API (Opcional pero recomendado)

1. En el menú lateral, ve a **"APIs y servicios" → "Biblioteca"**
2. Busca "Google+ API"
3. Haz clic en "Google+ API"
4. Haz clic en **"Habilitar"**

> **Nota:** Esto es opcional para OAuth básico, pero recomendado para obtener información adicional del perfil.

### 3. Configurar la Pantalla de Consentimiento OAuth

1. En el menú lateral, ve a **"APIs y servicios" → "Pantalla de consentimiento de OAuth"**
2. Selecciona **"Externos"** (si es para pruebas/desarrollo)
3. Haz clic en **"Crear"**

#### 3.1. Información de la App

Completa los campos obligatorios:
- **Nombre de la aplicación:** `Quiniela Platform`
- **Correo de asistencia al usuario:** Tu email de Gmail
- **Logo de la aplicación:** (Opcional) Puedes subirlo después
- **Correo electrónico del desarrollador:** Tu email de Gmail

Haz clic en **"Guardar y continuar"**

#### 3.2. Permisos (Scopes)

En esta sección puedes dejarlo vacío o agregar scopes básicos:
- `email`
- `profile`
- `openid`

Estos scopes se solicitan automáticamente por Google Sign In.

Haz clic en **"Guardar y continuar"**

#### 3.3. Usuarios de Prueba (Solo para modo desarrollo)

Si tu app está en modo "Externo" y no publicada, necesitas agregar usuarios de prueba:

1. Haz clic en **"Agregar usuarios"**
2. Agrega los emails de las personas que probarán la app (incluyendo el tuyo)
3. Haz clic en **"Agregar"**
4. Haz clic en **"Guardar y continuar"**

#### 3.4. Resumen

Revisa la información y haz clic en **"Volver al panel"**

### 4. Crear Credenciales OAuth 2.0

1. En el menú lateral, ve a **"APIs y servicios" → "Credenciales"**
2. Haz clic en **"Crear credenciales"** (parte superior)
3. Selecciona **"ID de cliente de OAuth 2.0"**

#### 4.1. Configurar el Cliente OAuth

1. **Tipo de aplicación:** Selecciona **"Aplicación web"**
2. **Nombre:** `Quiniela Web Client` (o el que prefieras)

3. **Orígenes de JavaScript autorizados:**
   - Para desarrollo local: `http://localhost:5173`
   - Para producción: `https://tudominio.com`

4. **URIs de redirección autorizados:**
   - Para desarrollo: `http://localhost:5173`
   - Para producción: `https://tudominio.com`

   > **Nota:** Google Sign In no requiere URIs de redirección específicos como `/callback`, solo el origen.

5. Haz clic en **"Crear"**

#### 4.2. Copiar el Client ID

Aparecerá un modal con tus credenciales:
- **ID de cliente:** `123456789-abc...xyz.apps.googleusercontent.com`
- **Secreto del cliente:** `GOCSPX-...` (no lo necesitas para el frontend)

**Copia el ID de cliente** y guárdalo.

---

## 🔧 Configuración en tu Aplicación

### Backend (.env)

Agrega la siguiente variable a `backend/.env`:

```env
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

**Ejemplo:**
```env
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
```

### Frontend (.env)

Crea o actualiza `frontend/.env`:

```env
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

**Ejemplo:**
```env
VITE_GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
```

> **IMPORTANTE:** El mismo Client ID se usa en backend y frontend.

---

## ✅ Verificar la Configuración

### 1. Backend

Reinicia el servidor backend:
```bash
cd backend
npm run dev
```

Deberías ver en los logs que **NO** aparece el warning:
```
⚠️  GOOGLE_CLIENT_ID no configurado. Google OAuth NO funcionará.
```

### 2. Frontend

Reinicia el servidor frontend:
```bash
cd frontend
npm run dev
```

Ve a `http://localhost:5173` y deberías ver:
- El formulario de login normal
- Una línea divisoria que dice "o continúa con"
- El **botón de Google Sign In** (azul con el logo de Google)

### 3. Probar el Flujo

1. Haz clic en el botón de **"Continuar con Google"**
2. Selecciona tu cuenta de Google
3. Si estás en modo de prueba, verifica que tu email esté en la lista de usuarios de prueba
4. Acepta los permisos solicitados
5. Deberías ser redirigido al Dashboard automáticamente

**En el backend verás logs de auditoría:**
```
✅ Email enviado: ...
LOGIN_GOOGLE o REGISTER_GOOGLE
```

---

## 🔒 Seguridad

### Variables de Entorno

**NUNCA** commitees tus archivos `.env` al repositorio. Ya están en `.gitignore`.

**Compartir credenciales:**
- El `GOOGLE_CLIENT_ID` es **público** (se envía al frontend)
- El `GOOGLE_CLIENT_SECRET` (si lo usas) es **privado** (solo backend)

### Usuarios de Prueba vs Producción

**Desarrollo (Externo):**
- Solo usuarios agregados en "Usuarios de prueba" pueden iniciar sesión
- Ideal para desarrollo y testing

**Producción:**
- Debes **verificar tu app** con Google
- Proceso de revisión que puede tomar días/semanas
- Requiere políticas de privacidad, términos de servicio, etc.

Para MVP, quédate en modo "Externo" con usuarios de prueba.

---

## 🐛 Troubleshooting

### Error: "Access blocked: This app's request is invalid"

**Causa:** El origin del frontend no está en la lista de orígenes autorizados.

**Solución:**
1. Ve a Google Cloud Console → Credenciales
2. Edita tu OAuth 2.0 Client ID
3. Agrega `http://localhost:5173` a "Orígenes de JavaScript autorizados"
4. Guarda y espera 5 minutos para que se propague

### Error: "redirect_uri_mismatch"

**Causa:** La URI de redirección no coincide.

**Solución:**
- Para Google Sign In (One Tap/Button), no necesitas URIs de redirección específicos
- Solo asegúrate de que el origen esté autorizado

### Botón de Google no aparece

**Verifica:**
1. Que `VITE_GOOGLE_CLIENT_ID` esté en `frontend/.env`
2. Que reiniciaste el servidor frontend (`npm run dev`)
3. Que el script de Google esté cargado (abre DevTools → Network → busca `gsi/client`)
4. Revisa la consola del navegador por errores

### Error: "idpiframe_initialization_failed"

**Causa:** Cookies de terceros bloqueadas o navegador en modo incógnito.

**Solución:**
- Usa el navegador en modo normal (no incógnito)
- Habilita cookies de terceros (temporalmente para pruebas)
- En producción, configura dominios apropiados

---

## 📚 Referencias

- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 for Web Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [google-auth-library (Node.js)](https://github.com/googleapis/google-auth-library-nodejs)

---

## ✨ Siguientes Pasos

Una vez configurado Google OAuth:

1. **Prueba el flujo completo:**
   - Registro con Google
   - Login con Google
   - Vinculación de cuenta existente

2. **Producción:**
   - Agrega dominio real a orígenes autorizados
   - Completa la verificación de la app con Google
   - Publica políticas de privacidad y términos de servicio

3. **Mejoras futuras (v2.0):**
   - Desvinculación de cuenta Google
   - Múltiples proveedores OAuth (Facebook, Twitter, etc.)
   - Login sin password (passwordless)
