// ============================================================
// Configuración de Supabase
// ============================================================
const supabaseUrl = 'https://iuspypmzrwzlqolbkjhl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c3B5cG16cnd6bHFvbGJramhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1OTA5NDIsImV4cCI6MjA3NjE2Njk0Mn0.da86H7bm7lZ5T66qaNyjl1iflQ1xN-iy_5wanhdLzHE';
const supabaseDB = window.supabase.createClient(supabaseUrl, supabaseKey);

// ============================================================
// Constantes del horario
// ============================================================
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const BLOQUES_POR_DIA = { 'Lunes': 8, 'Martes': 8, 'Miércoles': 8, 'Jueves': 8, 'Viernes': 6 };

// Total real de bloques reservables en la semana, según los bloques
// definidos en la base de datos (4 días Lunes-Jueves + Viernes)
function calcularTotalBloquesSemana(bloques) {
    if (!Array.isArray(bloques) || bloques.length === 0) return 0;
    const bloquesLJ = bloques.filter(b => b.dia_semana === 'Lunes-Jueves').length;
    const bloquesV = bloques.filter(b => b.dia_semana === 'Viernes').length;
    return bloquesLJ * 4 + bloquesV;
}

// ============================================================
// Utilidades de fechas (zona horaria de Chile)
// ============================================================
function formatearFechaCorta(fechaInput) {
    if (!fechaInput) return '';

    let fecha;

    try {
        if (typeof fechaInput === 'string' && fechaInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fecha = new Date(fechaInput + 'T12:00:00-03:00');
        } else if (fechaInput instanceof Date) {
            fecha = fechaInput;
        } else if (typeof fechaInput === 'string') {
            fecha = new Date(fechaInput);
            if (isNaN(fecha.getTime()) && fechaInput.includes('/')) {
                const partes = fechaInput.split('/');
                if (partes.length === 3) {
                    fecha = new Date(partes[2], partes[1] - 1, partes[0]);
                }
            }
        } else if (typeof fechaInput === 'number') {
            fecha = new Date(fechaInput);
        } else {
            return '';
        }

        if (isNaN(fecha.getTime())) return '';

        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const anio = fecha.getFullYear();

        return `${dia}/${mes}/${anio}`;
    } catch (error) {
        console.error('Error formateando fecha:', error, 'Input:', fechaInput);
        return '';
    }
}

// Fecha corta sin año (para chips y pestañas): dd/mm
function formatearDiaMes(fechaString) {
    const corta = formatearFechaCorta(fechaString);
    return corta ? corta.substring(0, 5) : '';
}

function formatearFecha(fechaString) {
    if (!fechaString) return '';

    try {
        const fecha = new Date(fechaString + 'T12:00:00-03:00');
        if (isNaN(fecha.getTime())) return '';

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        try {
            return new Intl.DateTimeFormat('es-CL', options).format(fecha);
        } catch (e) {
            const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
        }
    } catch (error) {
        console.error('Error en formatearFecha:', error);
        return '';
    }
}

function calcularFecha(fechaInicio, dia) {
    if (!fechaInicio) return '';

    const fecha = new Date(fechaInicio + 'T12:00:00-03:00');
    fecha.setDate(fecha.getDate() + dia);

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

function obtenerViernesSemana(fechaInicio) {
    return calcularFecha(fechaInicio, 4);
}

function hoyISO() {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================
// Sistema de notificaciones (toasts, sin alert bloqueante)
// ============================================================
function obtenerContenedorToasts() {
    let contenedor = document.getElementById('contenedorToasts');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'contenedorToasts';
        document.body.appendChild(contenedor);
    }
    return contenedor;
}

function mostrarToast(mensaje, tipo = 'info', duracion = 4500) {
    const contenedor = obtenerContenedorToasts();

    const iconos = { exito: '✅', error: '❌', aviso: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.setAttribute('role', 'status');

    const icono = document.createElement('span');
    icono.textContent = iconos[tipo] || iconos.info;

    const texto = document.createElement('span');
    texto.textContent = mensaje;

    toast.appendChild(icono);
    toast.appendChild(texto);
    contenedor.appendChild(toast);

    const cerrar = () => {
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 300);
    };

    toast.addEventListener('click', cerrar);
    setTimeout(cerrar, duracion);
}

function mostrarError(mensaje) {
    mostrarToast(mensaje, 'error', 6000);
}

function mostrarExito(mensaje) {
    mostrarToast(mensaje, 'exito');
}

function mostrarAviso(mensaje) {
    mostrarToast(mensaje, 'aviso');
}

// ============================================================
// Selector de semanas deslizable (táctil y con mouse)
// ============================================================
const _selectorSemanas = {
    semanas: [],
    activaId: null,
    onSeleccion: null,
    arrastro: false
};

function inicializarSelectorSemanas(semanas, semanaActivaId, onSeleccion) {
    const contenedor = document.getElementById('selectorSemanas');
    if (!contenedor) return;

    // Ordenar de más antigua a más reciente para que el deslizamiento sea natural
    const ordenadas = [...semanas].sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)));

    _selectorSemanas.semanas = ordenadas;
    _selectorSemanas.onSeleccion = onSeleccion;

    contenedor.innerHTML = '';

    if (ordenadas.length === 0) {
        contenedor.innerHTML = '<p class="helper-text">No hay semanas disponibles.</p>';
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'selector-semanas';

    const flechaIzq = document.createElement('button');
    flechaIzq.type = 'button';
    flechaIzq.className = 'selector-flecha';
    flechaIzq.id = 'flechaSemanaAnterior';
    flechaIzq.setAttribute('aria-label', 'Semana anterior');
    flechaIzq.textContent = '◀';
    flechaIzq.onclick = () => moverSeleccionSemana(-1);

    const flechaDer = document.createElement('button');
    flechaDer.type = 'button';
    flechaDer.className = 'selector-flecha';
    flechaDer.id = 'flechaSemanaSiguiente';
    flechaDer.setAttribute('aria-label', 'Semana siguiente');
    flechaDer.textContent = '▶';
    flechaDer.onclick = () => moverSeleccionSemana(1);

    const pista = document.createElement('div');
    pista.className = 'pista-semanas';
    pista.id = 'pistaSemanas';

    ordenadas.forEach(semana => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip-semana';
        chip.dataset.semanaId = semana.id;

        const numero = document.createElement('span');
        numero.className = 'chip-numero';
        numero.textContent = `Semana ${semana.numero_semana}${semana.notas ? ' 📝' : ''}`;

        const fechas = document.createElement('span');
        fechas.className = 'chip-fechas';
        fechas.textContent = `${formatearDiaMes(semana.fecha_inicio)} – ${formatearDiaMes(semana.fecha_fin)}`;

        chip.appendChild(numero);
        chip.appendChild(fechas);

        chip.onclick = () => {
            // Ignorar el click que se dispara al soltar un arrastre
            if (_selectorSemanas.arrastro) return;
            seleccionarSemanaDelSelector(semana.id);
        };

        pista.appendChild(chip);
    });

    configurarArrastrePista(pista);

    wrapper.appendChild(flechaIzq);
    wrapper.appendChild(pista);
    wrapper.appendChild(flechaDer);
    contenedor.appendChild(wrapper);

    marcarSemanaActiva(semanaActivaId, true);
}

// Arrastre con mouse (en pantallas táctiles el scroll nativo ya funciona)
function configurarArrastrePista(pista) {
    let arrastrando = false;
    let inicioX = 0;
    let scrollInicial = 0;

    pista.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        arrastrando = true;
        _selectorSemanas.arrastro = false;
        inicioX = e.clientX;
        scrollInicial = pista.scrollLeft;
        pista.classList.add('arrastrando');
        pista.setPointerCapture(e.pointerId);
    });

    pista.addEventListener('pointermove', (e) => {
        if (!arrastrando) return;
        const delta = e.clientX - inicioX;
        if (Math.abs(delta) > 5) _selectorSemanas.arrastro = true;
        pista.scrollLeft = scrollInicial - delta;
    });

    const terminar = (e) => {
        if (!arrastrando) return;
        arrastrando = false;
        pista.classList.remove('arrastrando');
        if (e.pointerId !== undefined && pista.hasPointerCapture(e.pointerId)) {
            pista.releasePointerCapture(e.pointerId);
        }
        // Dejar pasar el evento click antes de limpiar la marca de arrastre
        setTimeout(() => { _selectorSemanas.arrastro = false; }, 50);
    };

    pista.addEventListener('pointerup', terminar);
    pista.addEventListener('pointercancel', terminar);
}

function moverSeleccionSemana(direccion) {
    const { semanas, activaId } = _selectorSemanas;
    const indice = semanas.findIndex(s => s.id == activaId);
    const nuevoIndice = indice + direccion;

    if (nuevoIndice < 0 || nuevoIndice >= semanas.length) return;
    seleccionarSemanaDelSelector(semanas[nuevoIndice].id);
}

function seleccionarSemanaDelSelector(semanaId) {
    const semana = _selectorSemanas.semanas.find(s => s.id == semanaId);
    if (!semana) return;

    marcarSemanaActiva(semanaId, false);

    if (typeof _selectorSemanas.onSeleccion === 'function') {
        _selectorSemanas.onSeleccion(semana);
    }
}

function marcarSemanaActiva(semanaId, instantaneo = false) {
    _selectorSemanas.activaId = semanaId;

    const pista = document.getElementById('pistaSemanas');
    if (!pista) return;

    let chipActivo = null;
    pista.querySelectorAll('.chip-semana').forEach(chip => {
        const esActivo = chip.dataset.semanaId == semanaId;
        chip.classList.toggle('activo', esActivo);
        if (esActivo) chipActivo = chip;
    });

    // Habilitar/deshabilitar flechas en los extremos
    const indice = _selectorSemanas.semanas.findIndex(s => s.id == semanaId);
    const flechaIzq = document.getElementById('flechaSemanaAnterior');
    const flechaDer = document.getElementById('flechaSemanaSiguiente');
    if (flechaIzq) flechaIzq.disabled = indice <= 0;
    if (flechaDer) flechaDer.disabled = indice === -1 || indice >= _selectorSemanas.semanas.length - 1;

    // Centrar el chip seleccionado en la pista
    if (chipActivo) {
        const destino = chipActivo.offsetLeft - (pista.clientWidth - chipActivo.offsetWidth) / 2;
        if (instantaneo) {
            pista.scrollTo({ left: destino });
        } else {
            pista.scrollTo({ left: destino, behavior: 'smooth' });
        }
    }
}

// ============================================================
// Renderizado compartido del horario
// Tabla en escritorio + tarjetas por día en móviles.
// ============================================================
const _estadoHorario = {
    parametros: null,
    diaMovil: 0
};

function obtenerBloqueParaDia(bloques, numeroBloque, diaIndex) {
    if (diaIndex === 4 && numeroBloque > BLOQUES_POR_DIA['Viernes']) return null;
    const tipo = diaIndex === 4 ? 'Viernes' : 'Lunes-Jueves';
    return bloques.find(b => b.numero_bloque === numeroBloque && b.dia_semana === tipo) || null;
}

// parametros: { bloques, reservas, semana, onLibre(bloque, diaIndex, nombreDia), onOcupada(reserva, bloque, diaIndex, nombreDia) }
function renderizarHorario(parametros) {
    _estadoHorario.parametros = parametros;

    // Por defecto mostrar el día de hoy si cae dentro de la semana
    const hoy = hoyISO();
    let diaHoy = -1;
    for (let d = 0; d < 5; d++) {
        if (calcularFecha(parametros.semana.fecha_inicio, d) === hoy) diaHoy = d;
    }
    _estadoHorario.diaMovil = diaHoy >= 0 ? diaHoy : Math.min(_estadoHorario.diaMovil, 4);

    renderizarTablaEscritorio();
    renderizarVistaMovil();
}

function renderizarTablaEscritorio() {
    const { bloques, reservas, semana, onLibre, onOcupada } = _estadoHorario.parametros;
    const cuerpo = document.getElementById('cuerpoTabla');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';

    if (!semana) {
        cuerpo.innerHTML = '<tr><td colspan="7">No hay semana seleccionada</td></tr>';
        return;
    }

    for (let bloqueNum = 1; bloqueNum <= 8; bloqueNum++) {
        const fila = document.createElement('tr');

        const celdaBloque = document.createElement('td');
        celdaBloque.textContent = bloqueNum;
        celdaBloque.style.fontWeight = 'bold';
        fila.appendChild(celdaBloque);

        const celdaHorario = document.createElement('td');
        const bloqueLJ = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves');
        celdaHorario.textContent = bloqueLJ ? `${bloqueLJ.hora_inicio} - ${bloqueLJ.hora_fin}` : '-';
        fila.appendChild(celdaHorario);

        for (let dia = 0; dia < 5; dia++) {
            const celdaDia = document.createElement('td');
            const nombreDia = DIAS_SEMANA[dia];
            const bloque = obtenerBloqueParaDia(bloques, bloqueNum, dia);

            if (bloque) {
                const fecha = calcularFecha(semana.fecha_inicio, dia);
                const reserva = reservas.find(r => r.bloque_id === bloque.id && r.fecha === fecha);

                if (reserva) {
                    celdaDia.className = 'bloque-ocupado';
                    const info = document.createElement('div');
                    info.className = 'info-reserva';

                    const curso = document.createElement('span');
                    curso.className = 'curso';
                    curso.textContent = reserva.curso;

                    const profesor = document.createElement('span');
                    profesor.className = 'profesor';
                    profesor.textContent = reserva.profesor;

                    info.appendChild(curso);
                    info.appendChild(profesor);
                    celdaDia.appendChild(info);

                    celdaDia.title = `Curso: ${reserva.curso}\nProfesor: ${reserva.profesor}\nActividad: ${reserva.actividad || 'Ninguna'}`;
                    celdaDia.onclick = () => onOcupada(reserva, bloque, dia, nombreDia);
                } else {
                    celdaDia.className = 'bloque-libre';
                    celdaDia.textContent = 'Disponible';
                    celdaDia.title = 'Click para registrar uso';
                    celdaDia.onclick = () => onLibre(bloque, dia, nombreDia);
                }
            } else {
                celdaDia.className = 'bloque-no-disponible';
                celdaDia.textContent = 'N/A';
                celdaDia.title = 'Bloque no disponible para este día';
            }

            fila.appendChild(celdaDia);
        }

        cuerpo.appendChild(fila);
    }
}

function renderizarVistaMovil() {
    const contenedor = document.getElementById('vistaMovil');
    if (!contenedor || !_estadoHorario.parametros) return;

    const { bloques, reservas, semana, onLibre, onOcupada } = _estadoHorario.parametros;
    contenedor.innerHTML = '';

    if (!semana) {
        contenedor.innerHTML = '<p class="helper-text">No hay semana seleccionada</p>';
        return;
    }

    // Pestañas de días
    const tabs = document.createElement('div');
    tabs.className = 'tabs-dias';

    for (let d = 0; d < 5; d++) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tab-dia' + (d === _estadoHorario.diaMovil ? ' activo' : '');

        const nombre = document.createElement('span');
        nombre.className = 'dia-nombre';
        nombre.textContent = DIAS_CORTOS[d];

        const fecha = document.createElement('span');
        fecha.className = 'dia-fecha';
        fecha.textContent = formatearDiaMes(calcularFecha(semana.fecha_inicio, d));

        tab.appendChild(nombre);
        tab.appendChild(fecha);
        tab.onclick = () => {
            _estadoHorario.diaMovil = d;
            renderizarVistaMovil();
        };

        tabs.appendChild(tab);
    }

    contenedor.appendChild(tabs);

    // Tarjetas de bloques del día seleccionado
    const lista = document.createElement('div');
    lista.className = 'lista-bloques-dia';

    const dia = _estadoHorario.diaMovil;
    const nombreDia = DIAS_SEMANA[dia];
    const bloquesDelDia = BLOQUES_POR_DIA[nombreDia];

    for (let bloqueNum = 1; bloqueNum <= bloquesDelDia; bloqueNum++) {
        const bloque = obtenerBloqueParaDia(bloques, bloqueNum, dia);
        if (!bloque) continue;

        const fecha = calcularFecha(semana.fecha_inicio, dia);
        const reserva = reservas.find(r => r.bloque_id === bloque.id && r.fecha === fecha);

        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-bloque ' + (reserva ? 'ocupado' : 'libre');

        const hora = document.createElement('div');
        hora.className = 'bloque-hora';
        hora.innerHTML = `<span class="numero">Bloque ${bloqueNum}</span><span class="horas">${bloque.hora_inicio}<br>${bloque.hora_fin}</span>`;

        const detalle = document.createElement('div');
        detalle.className = 'bloque-detalle';

        const accion = document.createElement('div');
        accion.className = 'bloque-accion';

        if (reserva) {
            const curso = document.createElement('span');
            curso.className = 'curso';
            curso.textContent = reserva.curso;

            const profesor = document.createElement('span');
            profesor.className = 'profesor';
            profesor.textContent = reserva.profesor;

            detalle.appendChild(curso);
            detalle.appendChild(profesor);
            accion.textContent = '›';
            tarjeta.onclick = () => onOcupada(reserva, bloque, dia, nombreDia);
        } else {
            detalle.innerHTML = '<span class="estado-libre">Disponible</span><span class="hint">Toque para registrar uso</span>';
            accion.textContent = '＋';
            tarjeta.onclick = () => onLibre(bloque, dia, nombreDia);
        }

        tarjeta.appendChild(hora);
        tarjeta.appendChild(detalle);
        tarjeta.appendChild(accion);
        lista.appendChild(tarjeta);
    }

    contenedor.appendChild(lista);
}

// ============================================================
// Ocupación por día (compartido)
// ============================================================
function calcularOcupacionPorDia(bloques, reservas, semana) {
    let maxOcupacion = { dia: 'N/A', porcentaje: 0 };
    const ocupacion = {};

    if (!semana) return { porDia: ocupacion, maxOcupacion };

    DIAS_SEMANA.forEach((dia, index) => {
        let bloquesDia = 0;
        let ocupadosDia = 0;

        for (let bloqueNum = 1; bloqueNum <= 8; bloqueNum++) {
            const bloque = obtenerBloqueParaDia(bloques, bloqueNum, index);
            if (bloque) {
                bloquesDia++;
                const fecha = calcularFecha(semana.fecha_inicio, index);
                const reserva = reservas.find(r => r.bloque_id === bloque.id && r.fecha === fecha);
                if (reserva) ocupadosDia++;
            }
        }

        const porcentajeDia = bloquesDia > 0 ? Math.round((ocupadosDia / bloquesDia) * 100) : 0;
        ocupacion[dia] = { ocupados: ocupadosDia, total: bloquesDia, porcentaje: porcentajeDia };

        if (porcentajeDia > maxOcupacion.porcentaje) {
            maxOcupacion = { dia, porcentaje: porcentajeDia };
        }
    });

    return { porDia: ocupacion, maxOcupacion };
}

// ============================================================
// Cursos
// ============================================================

// Opciones adicionales que solo ve el administrador (bloqueos de
// sala por mantención, actividades internas, feriados, etc.)
const CURSOS_ADMINISTRATIVOS = ['Mantención', 'UTP', 'Senda Previene', 'Feriado', 'Vacaciones'];

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

function cargarCursosEnSelect(selectElement, cursoSeleccionado = '', incluirAdministrativos = false) {
    selectElement.innerHTML = '<option value="">Seleccione un curso</option>';

    const crearOpcion = (valor) => {
        const option = document.createElement('option');
        option.value = valor;
        option.textContent = valor;
        if (cursoSeleccionado && valor === cursoSeleccionado) {
            option.selected = true;
        }
        return option;
    };

    const grupoCursos = document.createElement('optgroup');
    grupoCursos.label = 'Cursos';
    generarOpcionesCursos().forEach(curso => grupoCursos.appendChild(crearOpcion(curso.valor)));
    selectElement.appendChild(grupoCursos);

    if (incluirAdministrativos) {
        const grupoAdmin = document.createElement('optgroup');
        grupoAdmin.label = 'Uso administrativo';
        CURSOS_ADMINISTRATIVOS.forEach(nombre => grupoAdmin.appendChild(crearOpcion(nombre)));
        selectElement.appendChild(grupoAdmin);
    }
}

function inicializarSelectsCursos() {
    const selectsCurso = document.querySelectorAll('#inputCurso, #inputCursoEditar');

    selectsCurso.forEach(select => {
        if (select && !select.hasAttribute('data-inicializado')) {
            cargarCursosEnSelect(select);
            select.setAttribute('data-inicializado', 'true');
        }
    });
}

// ============================================================
// Comportamiento general de la página
// ============================================================

// Prevenir envío accidental con Enter fuera de formularios
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    inicializarSelectsCursos();
});
