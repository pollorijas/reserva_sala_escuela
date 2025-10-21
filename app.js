// Configuración de Supabase - REEMPLAZA CON TUS CREDENCIALES
const supabaseUrl = 'https://iuspypmzrwzlqolbkjhl.supabase.co'; // Tu URL de Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c3B5cG16cnd6bHFvbGJramhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTA5NDIsImV4cCI6MjA3NjE2Njk0Mn0.da86H7bm7lZ5T66qaNyjl1iflQ1xN-iy_5wanhdLzHE'; // Tu API key pública
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales
let semanaActual = null;
let bloques = [];
let reservas = [];
let reservaSeleccionada = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación...');
    await cargarBloques();
    await cargarSemanas();
    
    // Configurar evento del formulario de nueva semana
    document.getElementById('formNuevaSemana').onsubmit = crearNuevaSemana;
    
    // Configurar evento del botón liberar
    document.getElementById('btnLiberar').onclick = liberarBloque;
});

async function cargarBloques() {
    console.log('Cargando bloques horarios...');
    const { data, error } = await supabase
        .from('bloques')
        .select('*')
        .order('dia_semana')
        .order('numero_bloque');
    
    if (error) {
        console.error('Error cargando bloques:', error);
        alert('Error al cargar bloques horarios: ' + error.message);
        return;
    }
    
    bloques = data;
    console.log('Bloques cargados:', bloques.length);
}

async function cargarSemanas() {
    console.log('Cargando semanas...');
    const { data, error } = await supabase
        .from('semanas')
        .select('*')
        .order('fecha_inicio', { ascending: false });
    
    if (error) {
        console.error('Error cargando semanas:', error);
        alert('Error al cargar semanas: ' + error.message);
        return;
    }
    
    const select = document.getElementById('selectSemana');
    select.innerHTML = '';
    
    if (data.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay semanas creadas';
        select.appendChild(option);
    } else {
        data.forEach(semana => {
            const option = document.createElement('option');
            option.value = semana.id;
            option.textContent = `Semana ${semana.numero_semana} (${formatearFecha(semana.fecha_inicio)} a ${formatearFecha(semana.fecha_fin)})`;
            select.appendChild(option);
        });
        
        semanaActual = data[0];
        await cargarReservasSemana(semanaActual.id);
    }
    
    select.onchange = async function() {
        const semanaId = this.value;
        if (semanaId) {
            semanaActual = data.find(s => s.id == semanaId);
            await cargarReservasSemana(semanaId);
        }
    };
}

async function cargarReservasSemana(semanaId) {
    console.log('Cargando reservas para semana:', semanaId);
    const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('semana_id', semanaId);
    
    if (error) {
        console.error('Error cargando reservas:', error);
        alert('Error al cargar reservas: ' + error.message);
        return;
    }
    
    reservas = data || [];
    console.log('Reservas cargadas:', reservas.length);
    await generarTablaHorarios();
    actualizarInfoSemana();
}

function actualizarInfoSemana() {
    const infoContainer = document.getElementById('infoSemana');
    if (!semanaActual) {
        infoContainer.innerHTML = '<p>No hay semana seleccionada</p>';
        return;
    }
    
    const reservasCount = reservas.length;
    const bloquesTotales = 34; // 8 bloques x 4 días + 6 bloques viernes
    
    infoContainer.innerHTML = `
        <h3>Semana ${semanaActual.numero_semana}</h3>
        <p><strong>Período:</strong> ${formatearFecha(semanaActual.fecha_inicio)} - ${formatearFecha(semanaActual.fecha_fin)}</p>
        <p><strong>Bloques ocupados:</strong> ${reservasCount} / ${bloquesTotales} (${Math.round(reservasCount/bloquesTotales*100)}%)</p>
        ${semanaActual.notas ? `<p><strong>Notas:</strong> ${semanaActual.notas}</p>` : ''}
    `;
}

async function generarTablaHorarios() {
    console.log('Generando tabla de horarios...');
    const cuerpo = document.getElementById('cuerpoTabla');
    cuerpo.innerHTML = '';
    
    if (!semanaActual) {
        cuerpo.innerHTML = '<tr><td colspan="7">No hay semana seleccionada</td></tr>';
        return;
    }
    
    // Generar filas para bloques 1-8
    for (let bloqueNum = 1; bloqueNum <= 8; bloqueNum++) {
        const fila = document.createElement('tr');
        
        // Celda de número de bloque
        const celdaBloque = document.createElement('td');
        celdaBloque.textContent = bloqueNum;
        celdaBloque.style.fontWeight = 'bold';
        fila.appendChild(celdaBloque);
        
        // Celda de horario
        const celdaHorario = document.createElement('td');
        const bloqueLJ = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves');
        
        if (bloqueLJ) {
            celdaHorario.textContent = `${bloqueLJ.hora_inicio} - ${bloqueLJ.hora_fin}`;
        } else {
            celdaHorario.textContent = '-';
        }
        fila.appendChild(celdaHorario);
        
        // Celdas para cada día (Lunes a Viernes)
        for (let dia = 0; dia < 5; dia++) {
            const celdaDia = document.createElement('td');
            const nombreDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][dia];
            
            // Determinar el bloque correcto según el día
            let bloqueId = null;
            if (dia === 4) { // Viernes
                const bloqueV = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Viernes');
                bloqueId = bloqueV ? bloqueV.id : null;
            } else { // Lunes a Jueves
                const bloqueLJ = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves');
                bloqueId = bloqueLJ ? bloqueLJ.id : null;
            }
            
            if (bloqueId && ((dia === 4 && bloqueNum <= 6) || (dia !== 4 && bloqueNum <= 8))) {
                const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
                const reservaExistente = reservas.find(r => 
                    r.bloque_id === bloqueId && r.fecha === fecha
                );
                
                if (reservaExistente) {
                    // Bloque ocupado - hacer clickeable para editar
                    celdaDia.className = 'bloque-ocupado';
                    celdaDia.innerHTML = `
                        <div class="info-reserva">
                            <span class="curso">${reservaExistente.curso}</span>
                            <span class="profesor">${reservaExistente.profesor}</span>
                        </div>
                    `;
                    celdaDia.title = `Click para editar o liberar\nActividad: ${reservaExistente.actividad || 'Ninguna'}\nObservaciones: ${reservaExistente.observaciones || 'Ninguna'}`;
                    celdaDia.onclick = () => abrirModalEdicion(reservaExistente, bloqueId, dia, nombreDia);
                } else {
                    // Bloque libre
                    celdaDia.className = 'bloque-libre';
                    celdaDia.textContent = 'Disponible';
                    celdaDia.setAttribute('data-bloque-id', bloqueId);
                    celdaDia.setAttribute('data-dia', dia);
                    celdaDia.onclick = () => abrirModalRegistro(bloqueId, dia, nombreDia);
                }
            } else {
                celdaDia.textContent = '-';
                celdaDia.style.backgroundColor = '#f8f9fa';
            }
            
            fila.appendChild(celdaDia);
        }
        
        cuerpo.appendChild(fila);
    }
}

function abrirModalRegistro(bloqueId, dia, nombreDia) {
    if (!semanaActual) return;
    
    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
    const bloque = bloques.find(b => b.id === bloqueId);
    
    document.getElementById('bloqueSeleccionado').value = bloqueId;
    document.getElementById('fechaSeleccionada').value = fecha;
    document.getElementById('reservaId').value = '';
    
    // Configurar modal para nueva reserva
    document.getElementById('tituloModalRegistro').textContent = 
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;
    
    document.getElementById('btnLiberar').style.display = 'none';
    document.getElementById('formRegistro').reset();
    
    document.getElementById('modalRegistro').style.display = 'block';
}

function abrirModalEdicion(reserva, bloqueId, dia, nombreDia) {
    if (!semanaActual) return;
    
    const bloque = bloques.find(b => b.id === bloqueId);
    
    document.getElementById('bloqueSeleccionado').value = bloqueId;
    document.getElementById('fechaSeleccionada').value = reserva.fecha;
    document.getElementById('reservaId').value = reserva.id;
    
    // Llenar formulario con datos existentes
    document.getElementById('inputCurso').value = reserva.curso;
    document.getElementById('inputProfesor').value = reserva.profesor;
    document.getElementById('inputActividad').value = reserva.actividad || '';
    document.getElementById('inputObservaciones').value = reserva.observaciones || '';
    
    // Configurar modal para edición
    document.getElementById('tituloModalRegistro').textContent = 
        `Editar Reserva - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;
    
    document.getElementById('btnLiberar').style.display = 'inline-block';
    
    reservaSeleccionada = reserva;
    document.getElementById('modalRegistro').style.display = 'block';
}

// Evento del formulario de registro (nuevo y edición)
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();
    
    const reservaId = document.getElementById('reservaId').value;
    const reservaData = {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };
    
    let error;
    
    if (reservaId) {
        // Actualizar reserva existente
        console.log('Actualizando reserva:', reservaId, reservaData);
        ({ error } = await supabase
            .from('reservas')
            .update(reservaData)
            .eq('id', reservaId));
    } else {
        // Crear nueva reserva
        console.log('Creando nueva reserva:', reservaData);
        ({ error } = await supabase
            .from('reservas')
            .insert([reservaData]));
    }
    
    if (error) {
        console.error('Error guardando reserva:', error);
        alert('Error al guardar: ' + error.message);
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        alert(reservaId ? '✅ Reserva actualizada exitosamente' : '✅ Registro guardado exitosamente');
    }
};

async function liberarBloque() {
    const reservaId = document.getElementById('reservaId').value;
    
    if (!reservaId) {
        alert('No hay reserva seleccionada para liberar');
        return;
    }
    
    // Mostrar confirmación
    abrirModalConfirmacion(
        'Liberar Bloque',
        '¿Estás seguro de que deseas liberar este bloque? Esta acción no se puede deshacer.',
        async () => {
            console.log('Eliminando reserva:', reservaId);
            const { error } = await supabase
                .from('reservas')
                .delete()
                .eq('id', reservaId);
            
            if (error) {
                console.error('Error eliminando reserva:', error);
                alert('Error al liberar bloque: ' + error.message);
            } else {
                cerrarModal();
                await cargarReservasSemana(semanaActual.id);
                alert('✅ Bloque liberado exitosamente');
            }
        }
    );
}

// Modal para nueva semana
function abrirModalNuevaSemana() {
    // Establecer fecha predeterminada (próximo lunes)
    const hoy = new Date();
    const proximoLunes = new Date(hoy);
    proximoLunes.setDate(hoy.getDate() + (1 - hoy.getDay() + 7) % 7);
    
    document.getElementById('inputFechaInicio').value = proximoLunes.toISOString().split('T')[0];
    
    // Calcular número de semana automáticamente
    const numeroSemana = Math.ceil((proximoLunes - new Date(proximoLunes.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    document.getElementById('inputNumeroSemana').value = numeroSemana;
    
    document.getElementById('modalNuevaSemana').style.display = 'block';
}

async function crearNuevaSemana(e) {
    e.preventDefault();
    
    const fechaInicio = document.getElementById('inputFechaInicio').value;
    const numeroSemana = parseInt(document.getElementById('inputNumeroSemana').value);
    const notas = document.getElementById('inputNotas').value.trim();
    
    if (!fechaInicio || !numeroSemana) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }
    
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaInicioObj);
    fechaFinObj.setDate(fechaFinObj.getDate() + 4); // +4 días para el viernes
    
    const nuevaSemana = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFinObj.toISOString().split('T')[0],
        numero_semana: numeroSemana,
        notas: notas || null
    };
    
    console.log('Creando nueva semana:', nuevaSemana);
    
    const { error } = await supabase
        .from('semanas')
        .insert([nuevaSemana]);
    
    if (error) {
        console.error('Error creando semana:', error);
        alert('Error creando semana: ' + error.message);
    } else {
        cerrarModalNuevaSemana();
        await cargarSemanas();
        alert('✅ Semana creada exitosamente');
    }
}

// Sistema de confirmación
function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('tituloConfirmacion').textContent = titulo;
    document.getElementById('mensajeConfirmacion').textContent = mensaje;
    
    const btnConfirmar = document.getElementById('btnConfirmarSi');
    btnConfirmar.onclick = callback;
    
    document.getElementById('modalConfirmacion').style.display = 'block';
}

// Funciones auxiliares
function calcularFecha(fechaInicio, dia) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + dia);
    return fecha.toISOString().split('T')[0];
}

function formatearFecha(fechaString) {
    const fecha = new Date(fechaInicio);
    return fecha.toLocaleDateString('es-ES');
}

function formatearFecha(fechaString) {
    const fecha = new Date(fechaString);
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return fecha.toLocaleDateString('es-ES', options);
}

// Funciones para cerrar modales
function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
    reservaSeleccionada = null;
}

function cerrarModalNuevaSemana() {
    document.getElementById('modalNuevaSemana').style.display = 'none';
    document.getElementById('formNuevaSemana').reset();
}

function cerrarModalConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

// Cerrar modales al hacer click fuera
window.onclick = function(event) {
    const modals = ['modalRegistro', 'modalNuevaSemana', 'modalConfirmacion'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            if (modalId === 'modalRegistro') cerrarModal();
            if (modalId === 'modalNuevaSemana') cerrarModalNuevaSemana();
            if (modalId === 'modalConfirmacion') cerrarModalConfirmacion();
        }
    });
}

// Función para exportar datos
async function exportarDatos() {
    if (!semanaActual) {
        alert('Primero selecciona una semana');
        return;
    }
    
    // Obtener todas las reservas de la semana con información de bloques
    const { data: reservasCompletas, error } = await supabase
        .from('reservas')
        .select(`
            *,
            bloques (*)
        `)
        .eq('semana_id', semanaActual.id);
    
    if (error) {
        alert('Error al exportar datos: ' + error.message);
        return;
    }
    
    // Crear CSV
    let csv = 'Día,Fecha,Bloque,Horario,Curso,Profesor,Actividad,Observaciones\n';
    
    reservasCompletas.forEach(reserva => {
        const fecha = new Date(reserva.fecha);
        const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];
        
        csv += `"${diaSemana}","${reserva.fecha}","${reserva.bloques.numero_bloque}","${reserva.bloques.hora_inicio} - ${reserva.bloques.hora_fin}","${reserva.curso}","${reserva.profesor}","${reserva.actividad || ''}","${reserva.observaciones || ''}"\n`;
    });
    
    // Descargar archivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reservas_semana_${semanaActual.numero_semana}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}