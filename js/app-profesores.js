// Variables globales para profesores
let semanaActual = null;
let bloques = [];
let reservas = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación para profesores...');
    await cargarBloques();
    await cargarSemanas();
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
        option.textContent = 'No hay semanas disponibles';
        select.appendChild(option);
        mostrarError('No hay semanas configuradas. Contacte al administrador.');
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

// En app-profesores.js - REEMPLAZAR la función actualizarInfoSemana con versión corregida
function actualizarInfoSemana() {
    const infoContainer = document.getElementById('infoSemana');
    if (!semanaActual) {
        infoContainer.innerHTML = '<p>No hay semana seleccionada</p>';
        return;
    }
    
    const reservasCount = reservas.length;
    const bloquesTotales = 34;
    const porcentajeOcupacion = Math.round(reservasCount/bloquesTotales*100);
    const bloquesDisponibles = bloquesTotales - reservasCount;
    
    // Calcular estadísticas básicas
    const ocupacionPorDia = calcularOcupacionPorDia();
    
    infoContainer.innerHTML = `
        <div class="info-semana">
            <div class="info-semana-header">
                <div class="info-semana-titulo">
                    <h3>📅 Semana ${semanaActual.numero_semana}</h3>
                    <p>${formatearFecha(semanaActual.fecha_inicio)} - ${formatearFecha(semanaActual.fecha_fin)}</p>
                </div>
                
                <div class="info-semana-estadisticas">
                    <div class="estadistica-principal">
                        <span class="porcentaje-ocupacion">${porcentajeOcupacion}%</span>
                        <span class="texto-estadistica">ocupación</span>
                    </div>
                    <div class="detalles-estadistica">
                        <div class="detalle-item">
                            <strong>${reservasCount}</strong>
                            <div>ocupados</div>
                        </div>
                        <div class="detalle-item">
                            <strong>${bloquesDisponibles}</strong>
                            <div>libres</div>
                        </div>
                    </div>
                </div>
            </div>
                        
            <!-- NOTAS DE LA SEMANA - DESTACADAS PERO SOBRIAS -->
            <div class="notas-semana-container ${!semanaActual.notas ? 'sin-notas' : ''}">
                <div class="notas-semana-titulo">
                    <span class="icono">📌</span>
                    <span>Información importante</span>
                </div>
                <div class="notas-semana-contenido">
                    ${semanaActual.notas ? semanaActual.notas : ''}
                </div>
            </div>
            
            <div class="estado-sistema">
                ✅ Modo profesor - Solo puede registrar en bloques disponibles
            </div>
            
            <div class="zona-horaria-info">
                📍 Chile - ${new Date().toLocaleDateString('es-CL')}
            </div>
        </div>
    `;
}

// Mantener la función calcularOcupacionPorDia igual que antes
function calcularOcupacionPorDia() {
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const bloquesPorDia = { 'Lunes': 8, 'Martes': 8, 'Miércoles': 8, 'Jueves': 8, 'Viernes': 6 };
    
    let maxOcupacion = { dia: '', porcentaje: 0 };
    const ocupacion = {};
    
    dias.forEach((dia, index) => {
        const bloquesDia = bloquesPorDia[dia];
        let ocupadosDia = 0;
        
        for (let bloqueNum = 1; bloqueNum <= bloquesDia; bloqueNum++) {
            const bloqueId = dia === 'Viernes' ? 
                bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Viernes')?.id :
                bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves')?.id;
            
            if (bloqueId) {
                const fecha = calcularFecha(semanaActual.fecha_inicio, index);
                const reserva = reservas.find(r => r.bloque_id === bloqueId && r.fecha === fecha);
                if (reserva) ocupadosDia++;
            }
        }
        
        const porcentajeDia = Math.round((ocupadosDia / bloquesDia) * 100);
        ocupacion[dia] = { ocupados: ocupadosDia, total: bloquesDia, porcentaje: porcentajeDia };
        
        if (porcentajeDia > maxOcupacion.porcentaje) {
            maxOcupacion = { dia: dia, porcentaje: porcentajeDia };
        }
    });
    
    return { porDia: ocupacion, maxOcupacion: maxOcupacion };
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
            if (dia === 4) {
                const bloqueV = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Viernes');
                bloqueId = bloqueV ? bloqueV.id : null;
            } else {
                const bloqueLJ = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves');
                bloqueId = bloqueLJ ? bloqueLJ.id : null;
            }
            
            if (bloqueId && ((dia === 4 && bloqueNum <= 6) || (dia !== 4 && bloqueNum <= 8))) {
                const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
                const reservaExistente = reservas.find(r => 
                    r.bloque_id === bloqueId && r.fecha === fecha
                );
                
                if (reservaExistente) {
                    // Bloque ocupado - SOLO LECTURA
                    celdaDia.className = 'bloque-ocupado';
                    celdaDia.innerHTML = `
                        <div class="info-reserva">
                            <span class="curso">${reservaExistente.curso}</span>
                            <span class="profesor">${reservaExistente.profesor}</span>
                        </div>
                    `;
                    celdaDia.title = `RESERVADO\nCurso: ${reservaExistente.curso}\nProfesor: ${reservaExistente.profesor}\nClick para ver detalles`;
                    celdaDia.onclick = () => mostrarInformacionReserva(reservaExistente, bloqueId, dia, nombreDia);
                } else {
                    // Bloque libre - PUEDE REGISTRAR
                    celdaDia.className = 'bloque-libre';
                    celdaDia.textContent = 'Disponible';
                    celdaDia.setAttribute('data-bloque-id', bloqueId);
                    celdaDia.setAttribute('data-dia', dia);
                    celdaDia.title = `Click para registrar uso`;
                    celdaDia.onclick = () => abrirModalRegistro(bloqueId, dia, nombreDia);
                }
            } else {
                // Bloque no disponible (viernes después del bloque 6)
                celdaDia.className = 'bloque-no-disponible';
                celdaDia.textContent = 'N/A';
                celdaDia.title = 'Bloque no disponible para este día';
            }
            
            fila.appendChild(celdaDia);
        }
        
        cuerpo.appendChild(fila);
    }
}

// En app-profesores.js - MODIFICAR la función abrirModalRegistro
function abrirModalRegistro(bloqueId, dia, nombreDia) {
    if (!semanaActual) return;
    
    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
    const bloque = bloques.find(b => b.id === bloqueId);
    
    document.getElementById('bloqueSeleccionado').value = bloqueId;
    document.getElementById('fechaSeleccionada').value = fecha;
    
    // Configurar modal para nueva reserva
    document.getElementById('tituloModalRegistro').textContent = 
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;
    
    document.getElementById('formRegistro').reset();
    
    // CARGAR CURSOS EN EL SELECT
    const selectCurso = document.getElementById('inputCurso');
    cargarCursosEnSelect(selectCurso);
    
    document.getElementById('modalRegistro').style.display = 'block';
}

// Mostrar información de reserva (solo lectura)
function mostrarInformacionReserva(reserva, bloqueId, dia, nombreDia) {
    const bloque = bloques.find(b => b.id === bloqueId);
    const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
    
    // Llenar información en el modal de solo lectura
    document.getElementById('tituloModalSoloLectura').textContent = 
        `Reserva Existente - ${nombreDia} Bloque ${bloque.numero_bloque}`;
    
    document.getElementById('infoCurso').textContent = reserva.curso;
    document.getElementById('infoProfesor').textContent = reserva.profesor;
    document.getElementById('infoActividad').textContent = reserva.actividad || 'No especificada';
    document.getElementById('infoObservaciones').textContent = reserva.observaciones || 'Ninguna';
    document.getElementById('infoFecha').textContent = formatearFecha(fecha);
    document.getElementById('infoHorario').textContent = `${bloque.hora_inicio} - ${bloque.hora_fin}`;
    
    document.getElementById('modalSoloLectura').style.display = 'block';
}

// Evento del formulario de registro
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();
    
    const reservaData = {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };
    
    // Validaciones básicas
    if (!reservaData.curso || !reservaData.profesor) {
        mostrarError('Curso y profesor son campos obligatorios');
        return;
    }
    
    console.log('Creando nueva reserva:', reservaData);
    
    const { error } = await supabase
        .from('reservas')
        .insert([reservaData]);
    
    if (error) {
        console.error('Error guardando reserva:', error);
        if (error.code === '23505') {
            mostrarError('Este bloque ya ha sido reservado. Por favor, actualice la página.');
        } else {
            mostrarError('Error al guardar la reserva: ' + error.message);
        }
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        mostrarExito('✅ Reserva registrada exitosamente. No olvide asistir a la sala en el horario reservado.');
    }
};

// Funciones para cerrar modales
function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
}

function cerrarModalSoloLectura() {
    document.getElementById('modalSoloLectura').style.display = 'none';
}

// Cerrar modales al hacer click fuera
window.onclick = function(event) {
    const modalRegistro = document.getElementById('modalRegistro');
    const modalSoloLectura = document.getElementById('modalSoloLectura');
    
    if (event.target === modalRegistro) {
        cerrarModal();
    }
    if (event.target === modalSoloLectura) {
        cerrarModalSoloLectura();
    }
}