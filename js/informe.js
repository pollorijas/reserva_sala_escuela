// ============================================================
// Informe estadístico de uso de la sala (administradores)
// Analiza todas las reservas históricas y permite descargar
// el informe en PDF.
// ============================================================

let _datosInforme = null;

async function abrirModalInforme() {
    document.getElementById('contenidoInforme').innerHTML =
        '<p class="helper-text">Cargando estadísticas...</p>';
    document.getElementById('modalInforme').style.display = 'block';

    try {
        _datosInforme = await calcularEstadisticasGlobales();
        renderizarInforme(_datosInforme);
    } catch (error) {
        console.error('Error generando informe:', error);
        document.getElementById('contenidoInforme').innerHTML =
            `<p class="helper-text">Error al cargar estadísticas: ${error.message}</p>`;
    }
}

function cerrarModalInforme() {
    document.getElementById('modalInforme').style.display = 'none';
}

// ------------------------------------------------------------
// Cálculo de estadísticas sobre todas las reservas
// ------------------------------------------------------------
async function calcularEstadisticasGlobales() {
    const { data: todasReservas, error } = await supabaseDB
        .from('reservas')
        .select('*, bloques (*), semanas (*)');

    if (error) throw error;

    const reservasValidas = todasReservas || [];
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const porDia = {};
    const porBloque = {};
    const porCurso = {};
    const porProfesor = {};
    const porSemana = {};

    reservasValidas.forEach(r => {
        // Día de la semana
        const fecha = new Date(r.fecha + 'T12:00:00-03:00');
        if (!isNaN(fecha.getTime())) {
            const dia = nombresDias[fecha.getDay()];
            porDia[dia] = (porDia[dia] || 0) + 1;
        }

        // Bloque horario
        if (r.bloques) {
            const clave = `Bloque ${r.bloques.numero_bloque} (${r.bloques.hora_inicio} - ${r.bloques.hora_fin})`;
            porBloque[clave] = (porBloque[clave] || 0) + 1;
        }

        // Curso y profesor
        if (r.curso) porCurso[r.curso] = (porCurso[r.curso] || 0) + 1;
        if (r.profesor) porProfesor[r.profesor] = (porProfesor[r.profesor] || 0) + 1;

        // Semana
        if (r.semanas) {
            const clave = `Semana ${r.semanas.numero_semana} (${formatearFechaCorta(r.semanas.fecha_inicio)})`;
            porSemana[clave] = (porSemana[clave] || 0) + 1;
        }
    });

    const ordenar = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    const rankingDias = ordenar(porDia);
    const rankingBloques = ordenar(porBloque);
    const rankingCursos = ordenar(porCurso);
    const rankingProfesores = ordenar(porProfesor);
    const rankingSemanas = ordenar(porSemana);

    const totalReservas = reservasValidas.length;
    const semanasConUso = Object.keys(porSemana).length;

    return {
        totalReservas,
        semanasConUso,
        promedioSemanal: semanasConUso > 0 ? (totalReservas / semanasConUso).toFixed(1) : '0',
        diaMasOcupado: rankingDias[0] || ['N/A', 0],
        bloqueMasOcupado: rankingBloques[0] || ['N/A', 0],
        cursoTop: rankingCursos[0] || ['N/A', 0],
        profesorTop: rankingProfesores[0] || ['N/A', 0],
        semanaTop: rankingSemanas[0] || ['N/A', 0],
        rankingDias,
        rankingBloques,
        rankingCursos,
        rankingProfesores,
        rankingSemanas
    };
}

// ------------------------------------------------------------
// Presentación del informe en el modal
// ------------------------------------------------------------
function esc(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

function tablaRanking(titulo, columnas, filas, maximo = 10) {
    if (filas.length === 0) return '';

    const total = filas.reduce((suma, [, cantidad]) => suma + cantidad, 0);

    const cuerpo = filas.slice(0, maximo).map(([nombre, cantidad], i) => {
        const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${esc(nombre)}</td>
                <td class="num">${cantidad}</td>
                <td>
                    <div class="barra-ocupacion"><span style="width:${porcentaje}%"></span></div>
                </td>
                <td class="num">${porcentaje}%</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="informe-seccion">
            <h4>${titulo}</h4>
            <table class="tabla-informe">
                <thead>
                    <tr><th>#</th><th>${columnas}</th><th>Reservas</th><th></th><th>%</th></tr>
                </thead>
                <tbody>${cuerpo}</tbody>
            </table>
        </div>
    `;
}

function renderizarInforme(datos) {
    const contenedor = document.getElementById('contenidoInforme');

    if (datos.totalReservas === 0) {
        contenedor.innerHTML = '<p class="helper-text">Aún no hay reservas registradas en el sistema.</p>';
        return;
    }

    contenedor.innerHTML = `
        <div class="informe-grilla">
            <div class="informe-stat">
                <span class="valor">${datos.totalReservas}</span>
                <span class="etiqueta">Reservas totales</span>
            </div>
            <div class="informe-stat">
                <span class="valor">${datos.semanasConUso}</span>
                <span class="etiqueta">Semanas con uso</span>
            </div>
            <div class="informe-stat">
                <span class="valor">${datos.promedioSemanal}</span>
                <span class="etiqueta">Promedio por semana</span>
            </div>
            <div class="informe-stat">
                <span class="valor">${esc(datos.diaMasOcupado[0])}</span>
                <span class="etiqueta">Día más ocupado</span>
            </div>
            <div class="informe-stat">
                <span class="valor">${esc(datos.cursoTop[0])}</span>
                <span class="etiqueta">Curso que más usa la sala</span>
            </div>
            <div class="informe-stat">
                <span class="valor">${esc(datos.profesorTop[0])}</span>
                <span class="etiqueta">Profesor que más usa la sala</span>
            </div>
        </div>

        ${tablaRanking('📅 Días más ocupados', 'Día', datos.rankingDias)}
        ${tablaRanking('🕐 Horarios más ocupados', 'Bloque', datos.rankingBloques)}
        ${tablaRanking('🎓 Cursos que más utilizan la sala', 'Curso', datos.rankingCursos)}
        ${tablaRanking('👩‍🏫 Profesores que más utilizan la sala', 'Profesor', datos.rankingProfesores)}
        ${tablaRanking('📈 Semanas con más reservas', 'Semana', datos.rankingSemanas, 5)}
    `;
}

// ------------------------------------------------------------
// Descarga del informe en PDF
// ------------------------------------------------------------
async function descargarInformePDF() {
    try {
        if (!_datosInforme) {
            _datosInforme = await calcularEstadisticasGlobales();
        }
        const datos = _datosInforme;

        if (datos.totalReservas === 0) {
            mostrarAviso('No hay reservas registradas para generar el informe');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        // ----- Encabezado -----
        doc.setFillColor(51, 65, 92);
        doc.rect(0, 0, pageWidth, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORME DE USO - SALA DE COMPUTACIÓN', pageWidth / 2, 13, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el ${new Date().toLocaleString('es-CL')}`, pageWidth / 2, 21, { align: 'center' });

        // ----- Resumen general -----
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen general', margin, 40);

        doc.autoTable({
            startY: 44,
            margin: { left: margin, right: margin },
            theme: 'grid',
            head: [['Indicador', 'Valor']],
            body: [
                ['Reservas totales registradas', String(datos.totalReservas)],
                ['Semanas con uso de la sala', String(datos.semanasConUso)],
                ['Promedio de reservas por semana', datos.promedioSemanal],
                ['Día más ocupado', `${datos.diaMasOcupado[0]} (${datos.diaMasOcupado[1]} reservas)`],
                ['Horario más ocupado', `${datos.bloqueMasOcupado[0]} (${datos.bloqueMasOcupado[1]} reservas)`],
                ['Curso que más utiliza la sala', `${datos.cursoTop[0]} (${datos.cursoTop[1]} reservas)`],
                ['Profesor que más utiliza la sala', `${datos.profesorTop[0]} (${datos.profesorTop[1]} reservas)`],
                ['Semana con más reservas', `${datos.semanaTop[0]} (${datos.semanaTop[1]} reservas)`]
            ],
            styles: { fontSize: 9, cellPadding: 2.5 },
            headStyles: { fillColor: [79, 109, 245], textColor: [255, 255, 255] },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
        });

        // ----- Secciones de ranking -----
        const secciones = [
            ['Días más ocupados', 'Día', datos.rankingDias],
            ['Horarios más ocupados', 'Bloque', datos.rankingBloques],
            ['Cursos que más utilizan la sala', 'Curso', datos.rankingCursos],
            ['Profesores que más utilizan la sala', 'Profesor', datos.rankingProfesores],
            ['Semanas con más reservas', 'Semana', datos.rankingSemanas]
        ];

        secciones.forEach(([titulo, columna, filas]) => {
            if (filas.length === 0) return;

            const total = filas.reduce((suma, [, cantidad]) => suma + cantidad, 0);
            let posY = doc.lastAutoTable.finalY + 12;

            // Salto de página si no queda espacio para el título + algunas filas
            if (posY > 250) {
                doc.addPage();
                posY = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(31, 41, 55);
            doc.text(titulo, margin, posY);

            doc.autoTable({
                startY: posY + 4,
                margin: { left: margin, right: margin },
                theme: 'striped',
                head: [['#', columna, 'Reservas', '% del total']],
                body: filas.slice(0, 10).map(([nombre, cantidad], i) => [
                    String(i + 1),
                    nombre,
                    String(cantidad),
                    total > 0 ? `${Math.round((cantidad / total) * 100)}%` : '0%'
                ]),
                styles: { fontSize: 9, cellPadding: 2.5 },
                headStyles: { fillColor: [51, 65, 92], textColor: [255, 255, 255] },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    2: { cellWidth: 25, halign: 'right' },
                    3: { cellWidth: 25, halign: 'right' }
                }
            });
        });

        // ----- Pie de página en todas las hojas -----
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(130, 130, 130);
            doc.text(
                `Sistema de Registro de Sala · Página ${i} de ${totalPaginas}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 8,
                { align: 'center' }
            );
        }

        doc.save(`informe_uso_sala_${hoyISO()}.pdf`);
        mostrarExito('Informe PDF descargado');
    } catch (error) {
        console.error('Error generando informe PDF:', error);
        mostrarError('Error al generar el informe: ' + error.message);
    }
}
