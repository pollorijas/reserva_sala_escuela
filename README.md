# Sistema de Registro de Sala Completo

Sistema web para gestión de uso de salas educativas con dos interfaces:

## Estructura del Proyecto

- `index.html` - Página principal (selector de versión)
- `admin.html` - Versión para administradores
- `profesores.html` - Versión para profesores
- `js/common.js` - Configuración de Supabase, utilidades, selector de semanas y renderizado del horario
- `js/app-admin.js` / `js/app-profesores.js` - Lógica de cada versión
- `js/exportar.js` - Exportación CSV y PDF del horario semanal (admin)
- `js/informe.js` - Informe estadístico de uso con descarga en PDF (admin)
- `js/admin-api.js` - Sesión de administrador y comunicación con la API protegida
- `netlify/functions/admin-api.js` - Función serverless con las operaciones de administrador
- `db/seguridad.sql` - Script de seguridad para Supabase (RLS, validación de reservas, restricción de duplicados)
- `tests/` - Pruebas automáticas (ver sección Pruebas)

## Características

### 👨‍💼 Administradores
- Gestión completa de semanas
- Crear, modificar y eliminar reservas
- Editar notas de las semanas
- Exportación del horario semanal en PDF (bloques disponibles/ocupados) y CSV
- Informe estadístico: días y horarios más ocupados, cursos y profesores que más usan la sala (descargable en PDF)

### 👩‍🏫 Profesores
- Solo lectura de semanas existentes
- Registrar en bloques disponibles
- Consulta de información
- Sin capacidad de modificación

### 📱 Interfaz
- Selector de semanas deslizable: funciona con el dedo en pantallas táctiles y arrastrando o con las flechas usando el mouse
- En móviles el horario se muestra como tarjetas por día (pestañas Lun-Vie), optimizado al tacto
- Notificaciones no bloqueantes (toasts) en lugar de alertas

## Seguridad

El sistema usa dos niveles de acceso **sin pedir login a los profesores**:

- **Profesores (sin contraseña):** el navegador usa la clave pública (anon) de
  Supabase, que con Row Level Security activo solo puede **leer** los datos y
  **crear reservas de cursos de 1° a 8° Básico**. Nada más. La base de datos
  además valida cada reserva: largo máximo de los textos, fecha dentro de la
  semana indicada y bloque acorde al día (viernes / lunes a jueves).
- **Administradores (con contraseña):** crear, editar y liberar reservas (incluidos
  los usos administrativos: Mantención, UTP, Senda Previene, Feriado y Vacaciones),
  crear semanas y editar notas pasan por funciones de Netlify que validan la
  contraseña (`ADMIN_PASSWORD`) y usan la clave `service_role` de Supabase,
  que nunca llega al navegador. La contraseña se pide una vez al abrir
  `admin.html` y dura mientras la pestaña esté abierta.

### Activar la seguridad (una sola vez)

1. **Supabase**: abrir *SQL Editor*, pegar el contenido de `db/seguridad.sql`
   y ejecutarlo (se puede repetir sin problema). Esto activa RLS, elimina
   políticas antiguas que dejaban las tablas abiertas, impide reservar dos
   veces el mismo bloque, valida cada reserva y registra cuándo se creó
   (columna `creado_en`).
2. **Netlify**: en *Site settings → Environment variables* agregar:
   - `ADMIN_PASSWORD` = contraseña que usará el administrador
   - `SUPABASE_SERVICE_ROLE_KEY` = clave `service_role` del proyecto
     (Supabase: *Settings → API keys*; **nunca** ponerla en el código)
3. Volver a desplegar el sitio.

> ⚠️ Si se ejecuta el SQL sin configurar las variables en Netlify, la página
> de profesores sigue funcionando normalmente, pero las acciones de
> administrador quedarán bloqueadas hasta completar el paso 2.

## Configuración

1. Reemplazar credenciales de Supabase en `js/common.js` (líneas 4-5).

2. Configurar la base de datos con las tablas:
   - `semanas`
   - `bloques`
   - `reservas`

3. Ejecutar `db/seguridad.sql` en Supabase (ver sección Seguridad).

4. Desplegar en Netlify y configurar las variables de entorno.

### Envío de correos (deshabilitado temporalmente)

El aviso por correo a los profesores está **desactivado**: los correos
institucionales ya no permiten este tipo de envío. Se retiró el botón, el
modal y la función de Netlify. El código sigue disponible en el historial de
git (commit `3338895`, archivos `js/correo.js` y
`netlify/functions/enviar-correo.js`) por si se decide retomarlo con otro
servicio de correo. La variable `RESEND_API_KEY` en Netlify ya no se usa y
puede eliminarse.

## Pruebas

Hay pruebas automáticas en la carpeta `tests/`, con sus propias dependencias
(no se instalan al desplegar en Netlify). No usan la base de datos real: simulan
Supabase y la función de administrador.

```bash
cd tests
npm install
npx playwright install chromium   # solo la primera vez
npm test                          # unitarias + de navegador
```

- `npm run test:unit`: unitarias (fechas, ocupación, CSV, función `admin-api`,
  consistencia entre HTML y JS, y garantías de `db/seguridad.sql`).
- `npm run test:e2e`: de navegador con Playwright. Recorren las páginas de
  profesores (escritorio y celular) y de administradores: reservar, editar,
  liberar, selector de semanas, ventanas, exportaciones y protección contra HTML
  malicioso.
- Si ya tienes un Chromium instalado: `CHROMIUM_PATH=/ruta/a/chromium npm run test:e2e`.
- En GitHub se ejecutan solas en cada Pull Request (`.github/workflows/tests.yml`).

> Las pruebas **no** verifican la base de datos real (políticas RLS, trigger de
> validación): esas reglas se comprueban ejecutando `db/seguridad.sql` en Supabase.

## URLs de Acceso

- **Principal**: `https://tu-sitio.netlify.app`
- **Admin**: `https://tu-sitio.netlify.app/admin.html`
- **Profesores**: `https://tu-sitio.netlify.app/profesores.html`

## Tecnologías

- HTML, CSS, JavaScript (sin framework)
- Supabase (base de datos)
- Netlify (hosting y funciones serverless)
- jsPDF + jsPDF-AutoTable (generación de PDF)

## Estructura de Base de Datos

Ver scripts SQL en la documentación para crear las tablas necesarias.
