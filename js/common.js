// Configuración de Supabase - REEMPLAZA CON TUS CREDENCIALES
const supabaseUrl = 'https://iuspypmzrwzlqolbkjhl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c3B5cG16cnd6bHFvbGJramhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTA5NDIsImV4cCI6MjA3NjE2Njk0Mn0.da86H7bm7lZ5T66qaNyjl1iflQ1xN-iy_5wanhdLzHE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Funciones comunes para ambas versiones

// Formateo de fechas CORREGIDO para Chile
/*function formatearFecha(fechaString) {
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
}*/

// En common.js - REEMPLAZAR la función formatearFechaCorta

function formatearFechaCorta(fechaInput) {
    if (!fechaInput) return '';
    
    let fecha;
    
    try {
        // Si es string en formato YYYY-MM-DD
        if (typeof fechaInput === 'string' && fechaInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fecha = new Date(fechaInput + 'T12:00:00-03:00');
        } 
        // Si es un objeto Date
        else if (fechaInput instanceof Date) {
            fecha = fechaInput;
        }
        // Si es otro tipo de string
        else if (typeof fechaInput === 'string') {
            // Intentar parsear de diferentes formas
            fecha = new Date(fechaInput);
            
            // Si falla, intentar con formato día/mes/año
            if (isNaN(fecha.getTime()) && fechaInput.includes('/')) {
                const partes = fechaInput.split('/');
                if (partes.length === 3) {
                    fecha = new Date(partes[2], partes[1] - 1, partes[0]);
                }
            }
        }
        // Si es número (timestamp)
        else if (typeof fechaInput === 'number') {
            fecha = new Date(fechaInput);
        }
        // Cualquier otro caso
        else {
            console.warn('Formato de fecha no reconocido:', fechaInput);
            return '';
        }
        
        // Verificar si la fecha es válida
        if (isNaN(fecha.getTime())) {
            console.warn('Fecha inválida:', fechaInput);
            return '';
        }
        
        // Formatear manualmente para evitar problemas con Intl
        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const anio = fecha.getFullYear();
        
        return `${dia}/${mes}/${anio}`;
        
    } catch (error) {
        console.error('Error formateando fecha:', error, 'Input:', fechaInput);
        return '';
    }
}

// Función auxiliar para formatear fechas largas (también corregida)
function formatearFecha(fechaString) {
    if (!fechaString) return '';
    
    try {
        // Crear fecha específicamente para Chile
        const fecha = new Date(fechaString + 'T12:00:00-03:00');
        
        if (isNaN(fecha.getTime())) {
            console.warn('Fecha inválida en formatearFecha:', fechaString);
            return '';
        }
        
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        };
        
        // Intentar con formateador internacional
        try {
            return new Intl.DateTimeFormat('es-CL', options).format(fecha);
        } catch (e) {
            // Fallback manual
            const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const meses = [
                'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
            ];
            
            const diaSemana = dias[fecha.getDay()];
            const dia = fecha.getDate();
            const mes = meses[fecha.getMonth()];
            const anio = fecha.getFullYear();
            
            return `${diaSemana} ${dia} de ${mes} de ${anio}`;
        }
    } catch (error) {
        console.error('Error en formatearFecha:', error);
        return '';
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

// En common.js - ACTUALIZAR la inicialización
document.addEventListener('DOMContentLoaded', function() {
    manejarResponsive();
    optimizarParaMovil();
    window.addEventListener('resize', manejarResponsive);
    
    // INICIALIZAR SELECTS DE CURSOS
    inicializarSelectsCursos();
    
    // Prevenir zoom en inputs (iOS)
    let viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    }
});

// Generar lista de cursos de 1° a 8° básico con letras A, B
function generarOpcionesCursos() {
    const cursos = [];
    const letras = ['A', 'B'];
    
    for (let nivel = 1; nivel <= 8; nivel++) {
        letras.forEach(letra => {
            cursos.push({
                valor: `${nivel}° Básico ${letra}`,
                texto: `${nivel}° Básico ${letra}`
            });
        });
    }
    
    return cursos;
}

// Cargar cursos en un elemento select
function cargarCursosEnSelect(selectElement, cursoSeleccionado = '') {
    const cursos = generarOpcionesCursos();
    
    // Limpiar select
    selectElement.innerHTML = '<option value="">Seleccione un curso</option>';
    
    // Agregar opciones
    cursos.forEach(curso => {
        const option = document.createElement('option');
        option.value = curso.valor;
        option.textContent = curso.texto;
        
        // Seleccionar si coincide con el curso actual
        if (cursoSeleccionado && curso.valor === cursoSeleccionado) {
            option.selected = true;
        }
        
        selectElement.appendChild(option);
    });
}

// Función para inicializar selects de cursos en la página
function inicializarSelectsCursos() {
    const selectsCurso = document.querySelectorAll('#inputCurso, #inputCursoEditar');
    
    selectsCurso.forEach(select => {
        if (select && !select.hasAttribute('data-inicializado')) {
            cargarCursosEnSelect(select);
            select.setAttribute('data-inicializado', 'true');
        }
    });
}