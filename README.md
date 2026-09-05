# FichaMe

Plataforma de fichaje para empleados similar a Bedott. Los empleados entran con un **código PIN** que el administrador les asigna, y pueden registrar entrada/salida. El admin puede corregir la hora si al empleado se le olvidó fichar.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS
- **Base de datos:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth solo para administradores, PIN custom para empleados
- **Mobile-first:** diseño optimizado para móvil (99% del uso), instalable como PWA
- **Despliegue:** Docker / docker-compose

## Requisitos

- Node.js 20+ (solo para desarrollo local)
- Una cuenta en [Supabase](https://supabase.com) (gratuita es suficiente)
- Docker en tu servidor

## Setup

### 1. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a **Settings → API** y copia la `Project URL` y la `anon public key`.
3. Abre el **SQL Editor** y pega el contenido de [`supabase/schema.sql`](supabase/schema.sql). Ejecútalo.
4. Crea tu usuario administrador en **Authentication → Users → Add user** (email + contraseña).
5. Tras crearlo, ve a la tabla `profiles` y cambia su `role` de `employee` a `admin`. *(Tras ejecutar el script verás su perfil creado automáticamente por el trigger).*

### 2. Configurar el proyecto

```bash
# Copia las variables de entorno
cp .env.example .env
# Rellena .env con tus valores de Supabase
```

### 3. Desarrollo local

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

## Uso

| Ruta | Descripción |
|------|-------------|
| `/` | Pantalla de fichaje del empleado (teclado numérico con PIN, kiosco full-screen) |
| `/admin` | Login de administrador |
| `/admin/dashboard` | Resumen del día (empleados, fichajes, pendientes) |
| `/admin/employees` | Gestión de empleados (crear, editar PIN, activar/desactivar) |
| `/admin/reports` | Historial de fichajes con filtros, exportación CSV y corrección de horas |

## PWA / Uso en móvil

La app es **mobile-first** y funciona como PWA:

- En el móvil, abre la URL y elige **"Añadir a pantalla de inicio"** (Android/Chrome) o **"Añadir a pantalla de inicio"** (iOS Safari). Se instalará como una app independiente sin barra del navegador.
- La pantalla de fichaje es un kiosco a pantalla completa con teclado numérico grande, pensado para usarse con el pulgar.
- El servicio worker permite abrir la app sin conexión (offline shell).

### Regenerar iconos

Los iconos se generan con PowerShell (System.Drawing). Si quieres cambiarlos:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-icons.ps1
```

### Flujo del empleado

1. Abre `/`.
2. Introduce su código PIN con el teclado numérico.
3. La app determina automáticamente si debe registrar **entrada** o **salida** (según el último fichaje).
4. Opcionalmente puede activar "Corregir hora" si se le olvidó fichar a su hora real.
5. Confirma y el fichaje queda registrado.

### Gestión de códigos

Los códigos PIN se asignan en **Admin → Empleados**. Son numéricos (máx. 6 dígitos) y únicos. Si un empleado olvida su código, el admin puede verlo y cambiarlo desde el panel.

## Despliegue con Docker

En tu servidor:

```bash
# 1. Copia el proyecto y crea el archivo .env con tus variables
cp .env.example .env
#   Rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Construye y levanta
docker compose up -d --build

# 3. Comprueba los logs
docker compose logs -f
```

La app estará disponible en `http://TU_SERVIDOR:3000`.

### Reverse proxy (opcional)

Para usar con un dominio y HTTPS, añade Nginx/Caddy/Traefik apuntando al puerto 3000.

## Seguridad

- Los PIN se almacenan en texto plano en la tabla `employees`. Para un uso real en producción se recomienda cifrarlos (ver sección de mejora abajo).
- El fichaje público usa funciones RPC `security definer` para verificar PIN y registrar fichajes sin exponer la tabla de empleados.
- Las tablas tienen **RLS habilitado**: solo admins pueden gestionar empleados/fichajes; el resto de accesos están restringidos por políticas.

## Mejoras sugeridas

- Cifrar los PIN con bcrypt (los empleados los introducen, no hace falta descifrarlos).
- Rate limiting en el teclado de PIN para evitar fuerza bruta.
- Geolocalización o código de sede al fichar.
- Notificaciones (email/Slack) de fichajes atípicos.
- Exportación de reportes en PDF y XLSX.