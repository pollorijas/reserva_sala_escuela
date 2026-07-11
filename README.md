# Sistema de Registro de Sala Completo

Sistema web para gestión de uso de salas educativas con dos interfaces:

## Estructura del Proyecto

- `index.html` - Página principal (selector de versión)
- `admin.html` - Versión para administradores
- `profesores.html` - Versión para profesores
- `js/common.js` - Configuración de Supabase, utilidades, selector de semanas y renderizado del horario
- `js/app-admin.js` / `js/app-profesores.js` - Lógica de cada versión
- `js/exportar.js` - Exportación CSV y PDF del horario semanal (admin)
- `js/correo.js` - Notificación de horarios por correo a profesores (admin)
- `js/informe.js` - Informe estadístico de uso con descarga en PDF (admin)
- `netlify/functions/enviar-correo.js` - Función serverless que envía los correos

## Características

### 👨‍💼 Administradores
- Gestión completa de semanas
- Crear, modificar y eliminar reservas
- Editar notas de las semanas
- Exportación del horario semanal en PDF (bloques disponibles/ocupados) y CSV
- Envío de correos a profesores con sus horarios reservados
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

## Configuración

1. Reemplazar credenciales de Supabase en `js/common.js` (líneas 4-5).

2. Configurar la base de datos con las tablas:
   - `semanas`
   - `bloques`
   - `reservas`

3. Desplegar en Netlify.

### Envío de correos (Resend)

El envío de correos usa la función serverless `netlify/functions/enviar-correo.js`
con la API de [Resend](https://resend.com). Para activarlo:

1. Crear una cuenta gratuita en Resend y generar una API key.
2. En Netlify: **Site settings → Environment variables**, agregar:
   - `RESEND_API_KEY` = la API key de Resend (obligatoria)
   - `EMAIL_FROM` = remitente verificado, ej. `sala@tuescuela.cl` (opcional)
3. Volver a desplegar el sitio.

> Sin `EMAIL_FROM` se usa `onboarding@resend.dev`, que **solo permite enviar
> correos a la dirección del dueño de la cuenta Resend** (útil para pruebas).
> Para enviar a los profesores hay que verificar un dominio propio en Resend
> y configurar `EMAIL_FROM` con una dirección de ese dominio.

## URLs de Acceso

- **Principal**: `https://tu-sitio.netlify.app`
- **Admin**: `https://tu-sitio.netlify.app/admin.html`
- **Profesores**: `https://tu-sitio.netlify.app/profesores.html`

## Tecnologías

- HTML, CSS, JavaScript (sin framework)
- Supabase (base de datos)
- Netlify (hosting y funciones serverless)
- jsPDF + jsPDF-AutoTable (generación de PDF)
- Resend (envío de correos)

## Estructura de Base de Datos

Ver scripts SQL en la documentación para crear las tablas necesarias.
