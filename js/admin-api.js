// ============================================================
// Sesión de administrador y comunicación con admin-api
//
// Con Row Level Security activo en Supabase, el navegador solo
// puede leer datos y crear reservas. Todas las operaciones de
// administrador pasan por /.netlify/functions/admin-api, que
// valida la contraseña (variable de entorno ADMIN_PASSWORD).
//
// La contraseña se guarda en sessionStorage: dura mientras la
// pestaña esté abierta y nunca se escribe en el código.
// ============================================================

const ADMIN_API_URL = '/.netlify/functions/admin-api';

function obtenerClaveAdmin() {
    return sessionStorage.getItem('claveAdmin') || '';
}

function guardarClaveAdmin(clave) {
    sessionStorage.setItem('claveAdmin', clave);
}

function limpiarClaveAdmin() {
    sessionStorage.removeItem('claveAdmin');
}

function mostrarLoginAdmin(mensajeError = '') {
    const modal = document.getElementById('modalLoginAdmin');
    if (!modal) return;

    const error = document.getElementById('errorLoginAdmin');
    if (error) {
        error.textContent = mensajeError;
        error.style.display = mensajeError ? 'block' : 'none';
    }

    modal.style.display = 'block';
    setTimeout(() => {
        const input = document.getElementById('inputClaveAdmin');
        if (input) input.focus();
    }, 100);
}

function cerrarLoginAdmin() {
    const modal = document.getElementById('modalLoginAdmin');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('inputClaveAdmin');
    if (input) input.value = '';
}

// Ejecuta una acción de administrador en el servidor.
// Lanza un error (ya notificado al usuario cuando corresponde)
// si no hay sesión, la contraseña es incorrecta o la acción falla.
async function llamarAdminAPI(accion, datos = {}, claveExplicita = null) {
    const clave = claveExplicita || obtenerClaveAdmin();

    if (!clave) {
        mostrarLoginAdmin('Debe ingresar la contraseña de administrador para realizar esta acción.');
        throw new Error('Sesión de administrador requerida');
    }

    const respuesta = await fetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, clave, datos })
    });

    const cuerpo = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
        limpiarClaveAdmin();
        if (!claveExplicita) {
            mostrarLoginAdmin('La contraseña ya no es válida. Ingrésela nuevamente.');
        }
        throw new Error(cuerpo.error || 'Contraseña de administrador incorrecta');
    }

    if (!respuesta.ok) {
        throw new Error(cuerpo.error || `Error del servidor (${respuesta.status})`);
    }

    return cuerpo;
}

// ------------------------------------------------------------
// Formulario de inicio de sesión
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('formLoginAdmin');
    if (!form) return;

    form.onsubmit = async function(e) {
        e.preventDefault();

        const input = document.getElementById('inputClaveAdmin');
        const boton = document.getElementById('btnLoginAdmin');
        const clave = input.value;

        if (!clave) return;

        boton.disabled = true;
        boton.textContent = 'Verificando...';

        try {
            await llamarAdminAPI('verificar', {}, clave);
            guardarClaveAdmin(clave);
            cerrarLoginAdmin();
            mostrarExito('Sesión de administrador iniciada');
        } catch (error) {
            input.value = '';
            mostrarLoginAdmin(error.message);
        } finally {
            boton.disabled = false;
            boton.textContent = 'Ingresar';
        }
    };

    // Pedir la contraseña al entrar si no hay sesión en esta pestaña
    if (!obtenerClaveAdmin()) {
        mostrarLoginAdmin();
    }
});
