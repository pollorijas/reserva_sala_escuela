// Variables globales para administradores
let semanaActual = null;
let bloques = [];
let reservas = [];
let reservaSeleccionada = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para administradores...');
    await cargarBloques();
    await cargarSemanas();
    
    // Configurar eventos
    document.getElementById('formNuevaSemana').onsubmit = crearNuevaSemana;
    document.getElementById('formEditarNotas').onsubmit = guardarNotasSemana;
    document.getElementById('btnEliminarNotas').onclick = eliminarNotasSemana;
    
    // Validar semanas existentes (para corregir fechas si es necesario)
    setTimeout(validarSemanasExistentes, 2000);
});

// Cargar bloques horarios
async function cargarBloques() {
    console.log('Cargando bloques horarios...');
    const { data, error } = await supabase
        .from('bloques')
        .select('*')
        .order('dia_semana')
        .order('numero_bloque');
    
    if (error) {
        console.error('Error cargando bloques:', error);
        mostrarError('Error al cargar bloques horarios: ' + error.message);
        return;
    }
    
    bloques = data;
    console.log('Bloques cargados:', bloques.length);
}

// Cargar semanas
async function cargarSemanas() {
    console.log('Cargando semanas...');
    const { data, error } = await supabase
        .from('semanas')
        .select('*')
        .order('fecha_inicio', { ascending: false });
    
    if (error) {
        console.error('Error cargando semanas:', error);
        mostrarError('Error al cargar semanas: ' + error.message);
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
            
            // Indicar en el texto si tiene notas
            const tieneNotas = semana.notas ? ' 📝' : '';
            option.textContent = `Semana ${semana.numero_semana} (${formatearFechaCorta(semana.fecha_inicio)} a ${formatearFechaCorta(semana.fecha_fin)})${tieneNotas}`;
            
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

// Cargar reservas de una semana
async function cargarReservasSemana(semanaId) {
    console.log('Cargando reservas para semana:', semanaId);
    const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('semana_id', semanaId);
    
    if (error) {
        console.error('Error cargando reservas:', error);
        mostrarError('Error al cargar reservas: ' + error.message);
        return;
    }
    
    reservas = data || [];
    console.log('Reservas cargadas:', reservas.length);
    await generarTablaHorarios();
    actualizarInfoSemana();
}

// Actualizar información de la semana
function actualizarInfoSemana() {
    const infoContainer = document.getElementById('infoSemana');
    if (!semanaActual) {
        infoContainer.innerHTML = '<p>No hay semana seleccionada</p>';
        return;
    }
    
    const reservasCount = reservas.length;
    const bloquesTotales = 34;
    const porcentajeOcupacion = Math.round(reservasCount/bloquesTotales*100);
    
    infoContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
            <div style="flex: 1;">
                <h3>Semana ${semanaActual.numero_semana}</h3>
                <p><strong>Período:</strong> ${formatearFecha(semanaActual.fecha_inicio)} - ${formatearFecha(semanaActual.fecha_fin)}</p>
                <p><strong>Bloques ocupados:</strong> ${reservasCount} / ${bloquesTotales} (${porcentajeOcupacion}%)</p>
                ${semanaActual.notas ? `
                    <div class="notas-semana">
                        <strong>📌 Notas:</strong> ${semanaActual.notas}
                    </div>
                ` : '<p class="sin-notas">ℹ️ No hay notas para esta semana</p>'}
            </div>
            <div>
                <button onclick="abrirModalEditarNotas()" class="btn-editar-notas">
                    ✏️ Editar Notas
                </button>
            </div>
        </div>
        <div class="zona-horaria-info">
            📍 Zona horaria: Chile (UTC-3)
        </div>
    `;
}

// Generar tabla de horarios
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

// Abrir modal para registro nuevo
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

// Abrir modal para edición
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
        mostrarError('Error al guardar: ' + error.message);
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        mostrarExito(reservaId ? '✅ Reserva actualizada exitosamente' : '✅ Registro guardado exitosamente');
    }
};

// Liberar bloque
async function liberarBloque() {
    const reservaId = document.getElementById('reservaId').value;
    
    if (!reservaId) {
        mostrarError('No hay reserva seleccionada para liberar');
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
                mostrarError('Error al liberar bloque: ' + error.message);
            } else {
                cerrarModal();
                await cargarReservasSemana(semanaActual.id);
                mostrarExito('✅ Bloque liberado exitosamente');
            }
        }
    );
}

// Modal para nueva semana
function abrirModalNuevaSemana() {
    // Encontrar el próximo lunes
    const hoy = new Date();
    const diasHastaLunes = (1 - hoy.getDay() + 7) % 7;
    const proximoLunes = new Date(hoy);
    proximoLunes.setDate(hoy.getDate() + (diasHastaLunes === 0 ? 7 : diasHastaLunes));
    
    // Formatear como YYYY-MM-DD
    const year = proximoLunes.getFullYear();
    const month = String(proximoLunes.getMonth() + 1).padStart(2, '0');
    const day = String(proximoLunes.getDate()).padStart(2, '0');
    const fechaProximoLunes = `${year}-${month}-${day}`;
    
    document.getElementById('inputFechaInicio').value = fechaProximoLunes;
    document.getElementById('inputFechaInicio').min = fechaProximoLunes;
    
    // Calcular número de semana automáticamente (según ISO)
    const primerDiaAno = new Date(proximoLunes.getFullYear(), 0, 1);
    const diferenciaTiempo = proximoLunes - primerDiaAno;
    const diferenciaDias = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
    const numeroSemana = Math.ceil((diferenciaDias + primerDiaAno.getDay() + 1) / 7);
    
    document.getElementById('inputNumeroSemana').value = numeroSemana;
    
    document.getElementById('modalNuevaSemana').style.display = 'block';
}

// Crear nueva semana
async function crearNuevaSemana(e) {
    e.preventDefault();
    
    const fechaInicioInput = document.getElementById('inputFechaInicio').value;
    const numeroSemana = parseInt(document.getElementById('inputNumeroSemana').value);
    const notas = document.getElementById('inputNotas').value.trim();
    
    if (!fechaInicioInput || !numeroSemana) {
        mostrarError('Por favor completa todos los campos requeridos');
        return;
    }
    
    // Asegurar que la fecha de inicio sea lunes
    const fechaInicio = obtenerLunesSemana(fechaInicioInput);
    const fechaFin = obtenerViernesSemana(fechaInicio);
    
    console.log('Fecha inicio (lunes):', fechaInicio);
    console.log('Fecha fin (viernes):', fechaFin);
    
    const nuevaSemana = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        numero_semana: numeroSemana,
        notas: notas || null
    };
    
    console.log('Creando nueva semana:', nuevaSemana);
    
    const { error } = await supabase
        .from('semanas')
        .insert([nuevaSemana]);
    
    if (error) {
        console.error('Error creando semana:', error);
        mostrarError('Error creando semana: ' + error.message);
    } else {
        cerrarModalNuevaSemana();
        await cargarSemanas();
        mostrarExito('✅ Semana creada exitosamente');
    }
}

// Abrir modal para editar notas
function abrirModalEditarNotas() {
    if (!semanaActual) {
        mostrarError('Primero seleccione una semana');
        return;
    }
    
    document.getElementById('semanaIdEditar').value = semanaActual.id;
    document.getElementById('infoSemanaTitulo').textContent = `Semana ${semanaActual.numero_semana}`;
    document.getElementById('infoSemanaFechas').textContent = 
        `${formatearFechaCorta(semanaActual.fecha_inicio)} - ${formatearFechaCorta(semanaActual.fecha_fin)}`;
    
    // Llenar el textarea con las notas actuales
    document.getElementById('inputNotasEditar').value = semanaActual.notas || '';
    
    // Mostrar/ocultar botón de eliminar notas
    const btnEliminar = document.getElementById('btnEliminarNotas');
    btnEliminar.style.display = semanaActual.notas ? 'inline-block' : 'none';
    
    document.getElementById('modalEditarNotas').style.display = 'block';
}

// Guardar notas de la semana
async function guardarNotasSemana(e) {
    e.preventDefault();
    
    const semanaId = document.getElementById('semanaIdEditar').value;
    const nuevasNotas = document.getElementById('inputNotasEditar').value.trim();
    
    console.log('Actualizando notas de la semana:', semanaId, nuevasNotas);
    
    const { error } = await supabase
        .from('semanas')
        .update({ notas: nuevasNotas || null })
        .eq('id', semanaId);
    
    if (error) {
        console.error('Error actualizando notas:', error);
        mostrarError('Error al actualizar notas: ' + error.message);
    } else {
        cerrarModalEditarNotas();
        
        // Actualizar la semana actual en memoria
        semanaActual.notas = nuevasNotas || null;
        
        // Recargar la información de la semana
        await cargarReservasSemana(semanaActual.id);
        
        mostrarExito('✅ Notas actualizadas exitosamente');
    }
}

// Eliminar notas de la semana
async function eliminarNotasSemana() {
    const semanaId = document.getElementById('semanaIdEditar').value;
    
    abrirModalConfirmacion(
        'Eliminar Notas',
        '¿Estás seguro de que deseas eliminar todas las notas de esta semana?',
        async () => {
            console.log('Eliminando notas de la semana:', semanaId);
            
            const { error } = await supabase
                .from('semanas')
                .update({ notas: null })
                .eq('id', semanaId);
            
            if (error) {
                console.error('Error eliminando notas:', error);
                mostrarError('Error al eliminar notas: ' + error.message);
            } else {
                cerrarModalEditarNotas();
                
                // Actualizar la semana actual en memoria
                semanaActual.notas = null;
                
                // Recargar la información de la semana
                await cargarReservasSemana(semanaActual.id);
                
                mostrarExito('✅ Notas eliminadas exitosamente');
            }
        }
    );
}

// Validar semanas existentes
async function validarSemanasExistentes() {
    const { data: semanas, error } = await supabase
        .from('semanas')
        .select('*');
    
    if (error) {
        console.error('Error validando semanas:', error);
        return;
    }
    
    let semanasCorregidas = 0;
    
    for (const semana of semanas) {
        // Verificar si el día de la semana es lunes (1)
        const fechaInicio = new Date(semana.fecha_inicio + 'T12:00:00-03:00');
        const diaSemanaInicio = fechaInicio.getDay();
        
        if (diaSemanaInicio !== 1) {
            console.warn(`Semana ${semana.numero_semana} no empieza en lunes:`, {
                fecha_inicio: semana.fecha_inicio,
                dia_semana: diaSemanaInicio
            });
            
            // Corregir automáticamente
            const fechaInicioCorregida = obtenerLunesSemana(semana.fecha_inicio);
            const fechaFinCorregida = obtenerViernesSemana(fechaInicioCorregida);
            
            const { error: updateError } = await supabase
                .from('semanas')
                .update({
                    fecha_inicio: fechaInicioCorregida,
                    fecha_fin: fechaFinCorregida
                })
                .eq('id', semana.id);
            
            if (!updateError) {
                semanasCorregidas++;
                console.log(`Semana ${semana.numero_semana} corregida:`, {
                    anterior: semana.fecha_inicio,
                    nuevo: fechaInicioCorregida
                });
            }
        }
    }
    
    if (semanasCorregidas > 0) {
        console.log(`✅ ${semanasCorregidas} semanas corregidas`);
        await cargarSemanas();
    }
}

// Exportar datos
async function exportarDatos() {
    if (!semanaActual) {
        mostrarError('Primero selecciona una semana');
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
        mostrarError('Error al exportar datos: ' + error.message);
        return;
    }
    
    // Crear CSV
    let csv = 'Día,Fecha,Bloque,Horario,Curso,Profesor,Actividad,Observaciones\n';
    
    reservasCompletas.forEach(reserva => {
        const fecha = new Date(reserva.fecha + 'T12:00:00-03:00');
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

function cerrarModalEditarNotas() {
    document.getElementById('modalEditarNotas').style.display = 'none';
    document.getElementById('formEditarNotas').reset();
}

function cerrarModalConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

// Sistema de confirmación
function abrirModalConfirmacion(titulo, mensaje, callback) {
    document.getElementById('tituloConfirmacion').textContent = titulo;
    document.getElementById('mensajeConfirmacion').textContent = mensaje;
    
    const btnConfirmar = document.getElementById('btnConfirmarSi');
    btnConfirmar.onclick = callback;
    
    document.getElementById('modalConfirmacion').style.display = 'block';
}

// Cerrar modales al hacer click fuera
window.onclick = function(event) {
    const modals = [
        'modalRegistro', 
        'modalNuevaSemana', 
        'modalConfirmacion',
        'modalEditarNotas'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            if (modalId === 'modalRegistro') cerrarModal();
            if (modalId === 'modalNuevaSemana') cerrarModalNuevaSemana();
            if (modalId === 'modalConfirmacion') cerrarModalConfirmacion();
            if (modalId === 'modalEditarNotas') cerrarModalEditarNotas();
        }
    });
}

// Asignar eventos a los botones
document.getElementById('btnLiberar').onclick = liberarBloque;