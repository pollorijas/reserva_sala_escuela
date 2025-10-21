# Sistema de Registro de Sala Completo

Sistema web para gestión de uso de salas educativas con dos interfaces:

## Estructura del Proyecto

- `index.html` - Página principal (selector de versión)
- `admin.html` - Versión para administradores
- `profesores.html` - Versión para profesores

## Características

### 👨‍💼 Administradores
- Gestión completa de semanas
- Crear, modificar y eliminar reservas
- Editar notas de las semanas
- Exportación de datos
- Control total del sistema

### 👩‍🏫 Profesores  
- Solo lectura de semanas existentes
- Registrar en bloques disponibles
- Consulta de información
- Sin capacidad de modificación

## Configuración

1. Reemplazar credenciales de Supabase en:
   - `js/common.js` (líneas 2-3)

2. Configurar la base de datos con las tablas:
   - semanas
   - bloques  
   - reservas

3. Desplegar en Netlify

## URLs de Acceso

- **Principal**: `https://tu-sitio.netlify.app`
- **Admin**: `https://tu-sitio.netlify.app/admin.html`
- **Profesores**: `https://tu-sitio.netlify.app/profesores.html`

## Tecnologías

- HTML, CSS, JavaScript
- Supabase (Base de datos)
- Netlify (Hosting)

## Estructura de Base de Datos

Ver scripts SQL en la documentación para crear las tablas necesarias.