// Configuración de Supabase - REEMPLAZA CON TUS CREDENCIALES
const supabaseUrl = 'https://iuspypmzrwzlqolbkjhl.supabase.co';
const supabaseKey = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c3B5cG16cnd6bHFvbGJramhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTA5NDIsImV4cCI6MjA3NjE2Njk0Mn0';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Funciones comunes para ambas versiones

// Formateo de fechas CORREGIDO para Chile
function formatearFecha(fechaString) {
    if (!fechaString) return '';
    
    // Crear fecha específicamente para Chile
    const fecha = new Date(fechaString + 'T12:00:00-03:00');
    
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'America/Santiago'
    };
    
    // Usar formateador con zona horaria específica
    try {
        return new Intl.DateTimeFormat('es-CL', options).format(fecha);
    } catch (e) {
        // Fallback si es-CL no está disponible
        return new Intl.DateTimeFormat('es-ES', options).format(fecha);
    }
}

function formatearFechaCorta(fechaString) {
    if (!fechaString) return '';
    
    const fecha = new Date(fechaString + 'T12:00:00-03:00');
    
    const options = {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        timeZone: 'America/Santiago'
    };
    
    try {
        return new Intl.DateTimeFormat('es-CL', options).format(fecha);
    } catch (e) {
        return new Intl.DateTimeFormat('es-ES', options).format(fecha);
    }
}

// Cálculo de fechas CORREGIDO para Chile
function calcularFecha(fechaInicio, dia) {
    if (!fechaInicio) return '';
    
    // Crear fecha en zona horaria local de Chile
    const fecha = new Date(fechaInicio + 'T12:00:00-03:00');
    fecha.setDate(fecha.getDate() + dia);
    
    // Formatear sin usar toISOString() para evitar problemas UTC
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para obtener el lunes de una semana
function obtenerLunesSemana(fecha) {
    const fechaObj = new Date(fecha + 'T12:00:00-03:00');
    const diaSemana = fechaObj.getDay();
    const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana;
    fechaObj.setDate(fechaObj.getDate() + diferencia);
    
    const year = fechaObj.getFullYear();
    const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const day = String(fechaObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para obtener el viernes de una semana (lunes + 4 días)
function obtenerViernesSemana(fechaInicio) {
    return calcularFecha(fechaInicio, 4);
}

// Sistema de notificaciones
function mostrarError(mensaje) {
    alert('❌ ' + mensaje);
}

function mostrarExito(mensaje) {
    alert('✅ ' + mensaje);
}

// Cerrar modales al hacer click fuera
function configurarCierreModal(modalId, cerrarFuncion) {
    const modal = document.getElementById(modalId);
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                cerrarFuncion();
            }
        });
    }
}

// Prevenir envío con Enter fuera de formularios
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
    }
});

// Detectar y manejar cambios de tamaño para responsive
function manejarResponsive() {
    const esMovil = window.innerWidth <= 768;
    
    if (esMovil && typeof generarVistaMovil === 'function') {
        generarVistaMovil();
    } else if (typeof generarTablaHorarios === 'function') {
        const container = document.getElementById('tabla-container');
        if (container && !container.querySelector('.tabla-horarios')) {
            container.innerHTML = '<table class="tabla-horarios" id="tablaHorarios"><thead><tr><th>Bloque</th><th>Horario</th><th>Lunes</th><th>Martes</th><th>Miércoles</th><th>Jueves</th><th>Viernes</th></tr></thead><tbody id="cuerpoTabla"></tbody></table>';
        }
        generarTablaHorarios();
    }
}

// Optimizaciones para móviles
function optimizarParaMovil() {
    // Prevenir múltiples clicks rápidos
    let ultimoClick = 0;
    document.addEventListener('click', function(e) {
        const ahora = Date.now();
        if (ahora - ultimoClick < 1000) {
            e.preventDefault();
            e.stopPropagation();
        }
        ultimoClick = ahora;
    }, true);
}

// Ejecutar al cargar y al redimensionar
document.addEventListener('DOMContentLoaded', function() {
    manejarResponsive();
    optimizarParaMovil();
    window.addEventListener('resize', manejarResponsive);
});

// Prevenir zoom en inputs (iOS)
document.addEventListener('DOMContentLoaded', function() {
    let viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    }
});