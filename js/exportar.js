// ============================================================
// Exportación de datos de la semana (CSV y PDF)
// Requiere las variables globales de app-admin.js:
// semanaActual, bloques
// ============================================================

// Convierte un valor en una celda CSV segura:
//  - las comillas dobles se duplican ("") como exige el formato, para
//    que un texto con comillas no desplace las columnas siguientes
//  - si empieza con = + - @ (o tabulación / retorno), Excel y otras
//    planillas lo interpretarían como una fórmula (p. ej. =HYPERLINK(...)),
//    así que se antepone un apóstrofe para que se muestre como texto
function escaparCeldaCSV(valor) {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
}

// Exportar reservas de la semana como CSV
async function exportarDatos() {
    if (!semanaActual) {
        mostrarError('Primero selecciona una semana');
        return;
    }

    const { data: reservasCompletas, error } = await supabaseDB
        .from('reservas')
        .select('*, bloques (*)')
        .eq('semana_id', semanaActual.id);

    if (error) {
        mostrarError('Error al exportar datos: ' + error.message);
        return;
    }

    let csv = 'Día,Fecha,Bloque,Horario,Curso,Profesor,Actividad,Observaciones\n';

    reservasCompletas.forEach(reserva => {
        const fecha = new Date(reserva.fecha + 'T12:00:00-03:00');
        const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][fecha.getDay()];

        csv += [
            diaSemana,
            reserva.fecha,
            reserva.bloques.numero_bloque,
            `${reserva.bloques.hora_inicio} - ${reserva.bloques.hora_fin}`,
            reserva.curso,
            reserva.profesor,
            reserva.actividad,
            reserva.observaciones
        ].map(escaparCeldaCSV).join(',') + '\n';
    });

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservas_semana_${semanaActual.numero_semana}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mostrarExito('Archivo CSV descargado');
}

// Recorta un texto respetando palabras completas, para que no
// se corte una palabra a la mitad dentro de la celda del PDF.
function truncarPorPalabras(texto, maxLength) {
    if (!texto || texto.length <= maxLength) return texto || '';
    const recorte = texto.substring(0, maxLength);
    const ultimoEspacio = recorte.lastIndexOf(' ');
    return (ultimoEspacio > maxLength * 0.6 ? recorte.substring(0, ultimoEspacio) : recorte) + '…';
}

// ============================================================
// PDF del horario semanal
// Réplica del horario web: bloques disponibles en verde y
// ocupados en ámbar con curso, profesor y actividad.
// ============================================================
async function exportarPDFSemana() {
    if (!semanaActual) {
        mostrarError('Primero selecciona una semana');
        return;
    }

    try {
        mostrarToast('Generando PDF del horario...', 'info', 2500);

        const { data: reservasSemana, error } = await supabaseDB
            .from('reservas')
            .select('*')
            .eq('semana_id', semanaActual.id);

        if (error) throw error;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;

        // ----- Encabezado -----
        doc.setFillColor(51, 65, 92);
        doc.rect(0, 0, pageWidth, 24, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('HORARIO SEMANAL - SALA DE COMPUTACIÓN', pageWidth / 2, 11, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Semana ${semanaActual.numero_semana} · ${formatearFechaCorta(semanaActual.fecha_inicio)} al ${formatearFechaCorta(semanaActual.fecha_fin)}`,
            pageWidth / 2, 18, { align: 'center' }
        );

        let inicioTablaY = 30;

        // Notas de la semana
        if (semanaActual.notas) {
            doc.setTextColor(138, 93, 16);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            const notas = doc.splitTextToSize(`Notas: ${semanaActual.notas}`, pageWidth - margin * 2);
            doc.text(notas, margin, inicioTablaY);
            inicioTablaY += notas.length * 4 + 3;
        }

        // ----- Construcción de la tabla -----
        // Matriz paralela con el estado de cada celda para colorearla
        const cuerpo = [];
        const estados = [];

        for (let bloqueNum = 1; bloqueNum <= 8; bloqueNum++) {
            const bloqueLJ = bloques.find(b => b.numero_bloque === bloqueNum && b.dia_semana === 'Lunes-Jueves');
            if (!bloqueLJ) continue;

            const fila = [`Bloque ${bloqueNum}\n${bloqueLJ.hora_inicio} - ${bloqueLJ.hora_fin}`];
            const filaEstados = ['encabezado'];

            for (let dia = 0; dia < 5; dia++) {
                const bloque = obtenerBloqueParaDia(bloques, bloqueNum, dia);

                if (!bloque) {
                    fila.push('—');
                    filaEstados.push('na');
                    continue;
                }

                const fecha = calcularFecha(semanaActual.fecha_inicio, dia);
                const reserva = reservasSemana.find(r => r.bloque_id === bloque.id && r.fecha === fecha);

                if (reserva) {
                    // Se deja bastante margen (150 caracteres) porque la celda usa
                    // fuente reducida y ajuste de línea automático (ver autoTable
                    // más abajo); el recorte solo actúa como resguardo ante textos
                    // extremadamente largos.
                    let texto = `${truncarPorPalabras(reserva.curso, 60)}\n${truncarPorPalabras(reserva.profesor, 60)}`;
                    if (reserva.actividad) {
                        texto += `\n${truncarPorPalabras(reserva.actividad, 150)}`;
                    }
                    fila.push(texto);
                    filaEstados.push('ocupado');
                } else {
                    fila.push('DISPONIBLE');
                    filaEstados.push('libre');
                }
            }

            cuerpo.push(fila);
            estados.push(filaEstados);
        }

        doc.autoTable({
            startY: inicioTablaY,
            head: [['Bloque / Horario', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']],
            body: cuerpo,
            margin: { left: margin, right: margin },
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 1.8,
                valign: 'middle',
                halign: 'center',
                lineColor: [203, 213, 225],
                lineWidth: 0.2,
                textColor: [31, 41, 55],
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [51, 65, 92],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            // Altura mínima uniforme para que todas las filas se vean del
            // mismo tamaño; las celdas ocupadas usan fuente más chica para
            // que curso + profesor + actividad quepan sin cortarse.
            bodyStyles: {
                minCellHeight: 15
            },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 }
            },
            didParseCell: (data) => {
                if (data.section !== 'body' || data.column.index === 0) return;

                const estado = estados[data.row.index][data.column.index];

                if (estado === 'libre') {
                    data.cell.styles.fillColor = [227, 246, 234];
                    data.cell.styles.textColor = [46, 158, 91];
                    data.cell.styles.fontStyle = 'bold';
                } else if (estado === 'ocupado') {
                    data.cell.styles.fillColor = [253, 243, 227];
                    data.cell.styles.halign = 'left';
                    data.cell.styles.fontSize = 6.5;
                    data.cell.styles.cellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2 };
                } else if (estado === 'na') {
                    data.cell.styles.fillColor = [248, 250, 252];
                    data.cell.styles.textColor = [176, 184, 196];
                }
            }
        });

        // ----- Pie: leyenda y estadísticas -----
        const finTablaY = doc.lastAutoTable.finalY + 7;
        const bloquesTotales = calcularTotalBloquesSemana(bloques);
        const ocupados = reservasSemana.length;
        const porcentaje = bloquesTotales > 0 ? Math.round((ocupados / bloquesTotales) * 100) : 0;

        // Leyenda de colores
        doc.setFillColor(227, 246, 234);
        doc.rect(margin, finTablaY - 3, 5, 4, 'F');
        doc.setFontSize(8);
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'normal');
        doc.text('Disponible', margin + 7, finTablaY);

        doc.setFillColor(253, 243, 227);
        doc.rect(margin + 32, finTablaY - 3, 5, 4, 'F');
        doc.text('Ocupado', margin + 39, finTablaY);

        doc.setTextColor(100, 100, 100);
        doc.text(
            `Ocupación: ${ocupados} de ${bloquesTotales} bloques (${porcentaje}%)`,
            pageWidth / 2, finTablaY, { align: 'center' }
        );

        doc.text(
            `Generado: ${new Date().toLocaleString('es-CL')}`,
            pageWidth - margin, finTablaY, { align: 'right' }
        );

        doc.setFontSize(7);
        doc.text('Sistema de Registro de Sala', pageWidth / 2, pageHeight - 6, { align: 'center' });

        doc.save(`horario_semana_${semanaActual.numero_semana}.pdf`);
        mostrarExito('PDF del horario descargado');
    } catch (error) {
        console.error('Error generando PDF:', error);
        mostrarError('Error al generar PDF: ' + error.message);
    }
}
