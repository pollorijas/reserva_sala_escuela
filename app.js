// Configuración de Supabase - REEMPLAZA CON TUS CREDENCIALES
const supabaseUrl = 'https://tu-proyecto.supabase.co'; // Tu URL de Supabase
const supabaseKey = 'tu-anon-key'; // Tu API key pública
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales
let semanaActual = null;
let bloques = [];
let reservas = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando aplicación...');
    await cargarBloques();
    await cargarSemanas();
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
                    // Bloque ocupado
                    celdaDia.className = 'bloque-ocupado';
                    celdaDia.innerHTML = `
                        <strong>${reservaExistente.curso}</strong><br>
                        <small>${reservaExistente.profesor}</small>
                    `;
                    celdaDia.title = `Actividad: ${reservaExistente.actividad || 'Ninguna'}\nObservaciones: ${reservaExistente.observaciones || 'Ninguna'}`;
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
    
    // Actualizar título del modal
    document.querySelector('.modal-content h3').textContent = 
        `Registrar Uso - ${nombreDia} Bloque ${bloque.numero_bloque} (${bloque.hora_inicio} - ${bloque.hora_fin})`;
    
    document.getElementById('modalRegistro').style.display = 'block';
}

function calcularFecha(fechaInicio, dia) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + dia);
    return fecha.toISOString().split('T')[0];
}

function formatearFecha(fechaString) {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES');
}

// Evento del formulario de registro
document.getElementById('formRegistro').onsubmit = async function(e) {
    e.preventDefault();
    
    const reserva = {
        semana_id: semanaActual.id,
        bloque_id: parseInt(document.getElementById('bloqueSeleccionado').value),
        curso: document.getElementById('inputCurso').value.trim(),
        profesor: document.getElementById('inputProfesor').value.trim(),
        actividad: document.getElementById('inputActividad').value.trim(),
        observaciones: document.getElementById('inputObservaciones').value.trim(),
        fecha: document.getElementById('fechaSeleccionada').value
    };
    
    console.log('Guardando reserva:', reserva);
    
    const { error } = await supabase
        .from('reservas')
        .insert([reserva]);
    
    if (error) {
        console.error('Error guardando reserva:', error);
        alert('Error al guardar: ' + error.message);
    } else {
        cerrarModal();
        await cargarReservasSemana(semanaActual.id);
        alert('✅ Registro guardado exitosamente');
    }
};

function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('formRegistro').reset();
}

// Función para crear nueva semana
async function crearNuevaSemana() {
    const fechaInicio = prompt('Ingresa la fecha de inicio (YYYY-MM-DD):');
    if (!fechaInicio) return;
    
    const fechaInicioObj = new Date(fechaInicio);
    const fechaFinObj = new Date(fechaInicioObj);
    fechaFinObj.setDate(fechaFinObj.getDate() + 4); // +4 días para el viernes
    
    const numeroSemana = prompt('Ingresa el número de semana:');
    if (!numeroSemana) return;
    
    const nuevaSemana = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFinObj.toISOString().split('T')[0],
        numero_semana: parseInt(numeroSemana)
    };
    
    const { error } = await supabase
        .from('semanas')
        .insert([nuevaSemana]);
    
    if (error) {
        alert('Error creando semana: ' + error.message);
    } else {
        alert('Semana creada exitosamente');
        await cargarSemanas();
    }
}

// Cerrar modal al hacer click fuera
window.onclick = function(event) {
    const modal = document.getElementById('modalRegistro');
    if (event.target === modal) {
        cerrarModal();
    }
};
