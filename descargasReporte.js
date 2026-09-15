import { _supabase as supabaseImportado } from './config.js';

function obtenerClienteSupabase() {
    if (supabaseImportado && typeof supabaseImportado.from === 'function') {
        return supabaseImportado;
    }
    if (window._supabase && typeof window._supabase.from === 'function') {
        return window._supabase;
    }
    return null;
}

let registrosFiltradosCache = [];
let catalogoTecnicoCache = [];
let modoFiltroActual = 'semanas';

const ALIAS_PRODUCTOS = {
    'CAPTN': 'CAPTAN',
    'LUNA TRNAQUILITY': 'LUNA TRANQUILITY',
    'LUNA T': 'LUNA TRANQUILITY',
    'LUNA TRANG': 'LUNA TRANQUILITY',
    'TELDOR': 'TELDOR COMBI',
    'NANKI': 'NANKIN',
    'DAN BORD': 'AIRBORD',
    'VICENTI': 'VIDENTI'
};

function normalizarTexto(txt) {
    return String(txt || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function resolverAlias(nombre) {
    const limpio = normalizarTexto(nombre);
    return ALIAS_PRODUCTOS[limpio] || limpio;
}

function semanaAFechaAprox(semanaStr) {
    const s = String(semanaStr || '').trim();
    if (s.length >= 4) {
        const yy = parseInt(s.slice(0, 2), 10);
        const ww = parseInt(s.slice(2), 10);
        const anio = 2000 + yy;
        
        const fechaSimple = new Date(anio, 0, 1 + (ww - 1) * 7);
        const diaSemana = fechaSimple.getDay();
        const lunes = new Date(fechaSimple);
        if (diaSemana <= 4) {
            lunes.setDate(fechaSimple.getDate() - fechaSimple.getDay() + 1);
        } else {
            lunes.setDate(fechaSimple.getDate() + 8 - fechaSimple.getDay());
        }
        return lunes.toISOString().split('T')[0];
    }
    return null;
}

window.cambiarModoFiltroReporte = function(modo) {
    modoFiltroActual = modo;
    const colSemUnica = document.getElementById('col-rep-sem-unica');
    const colFecDesde = document.getElementById('col-rep-fec-desde');
    const colFecHasta = document.getElementById('col-rep-fec-hasta');

    if (modo === 'semanas') {
        if (colSemUnica) colSemUnica.classList.remove('hidden');
        if (colFecDesde) colFecDesde.classList.add('hidden');
        if (colFecHasta) colFecHasta.classList.add('hidden');
    } else {
        if (colSemUnica) colSemUnica.classList.add('hidden');
        if (colFecDesde) colFecDesde.classList.remove('hidden');
        if (colFecHasta) colFecHasta.classList.remove('hidden');
    }
};

/**
 * Carga o asegura que las fichas técnicas de rotacion_productos estén en memoria
 */
async function asegurarCatalogoTecnico() {
    if (catalogoTecnicoCache.length > 0) return catalogoTecnicoCache;

    const sb = obtenerClienteSupabase();
    if (!sb) return [];

    try {
        const { data, error } = await sb.from('rotacion_productos').select('*');
        if (!error && data && data.length > 0) {
            catalogoTecnicoCache = data.map(item => ({
                producto: resolverAlias(item.producto),
                ingrediente_activo: item.ingrediente_activo || '--',
                frac: (item.frac !== null && item.frac !== undefined && item.frac !== '') ? item.frac : '--',
                irac: (item.irac !== null && item.irac !== undefined && item.irac !== '') ? item.irac : '--'
            }));
            window.datosFumigacionCache = catalogoTecnicoCache;
            return catalogoTecnicoCache;
        }
    } catch (e) {
        console.warn("No se pudo cargar rotacion_productos directamente:", e);
    }

    if (window.datosFumigacionCache && window.datosFumigacionCache.length > 0) {
        catalogoTecnicoCache = window.datosFumigacionCache;
    }
    return catalogoTecnicoCache;
}

/**
 * Busca la ficha de un producto individual en el catálogo
 */
function buscarFichaIndividual(nombre) {
    const limpio = resolverAlias(nombre);
    if (!limpio) return null;

    let match = catalogoTecnicoCache.find(p => normalizarTexto(p.producto) === limpio);
    if (match) return match;

    match = catalogoTecnicoCache.find(p => {
        const nomCat = normalizarTexto(p.producto);
        return nomCat.includes(limpio) || limpio.includes(nomCat);
    });

    return match || null;
}

/**
 * Desglosa mezclas (ej: CAPTAN/PYRIPROXIFEN) y recopila datos técnicos compuestos
 */
function resolverDatosTecnicos(productoStr) {
    const partes = String(productoStr || '')
        .split('/')
        .map(p => p.trim())
        .filter(Boolean);

    if (partes.length === 0) {
        return { ia: '--', frac: '--', irac: '--' };
    }

    const ias = [];
    const fracs = [];
    const iracs = [];

    partes.forEach(parte => {
        const ficha = buscarFichaIndividual(parte);
        if (ficha) {
            if (ficha.ingrediente_activo && ficha.ingrediente_activo !== '--') {
                ias.push(ficha.ingrediente_activo);
            }
            if (ficha.frac && ficha.frac !== '--') {
                fracs.push(ficha.frac);
            }
            if (ficha.irac && ficha.irac !== '--') {
                iracs.push(ficha.irac);
            }
        }
    });

    return {
        ia: ias.length > 0 ? [...new Set(ias)].join(' + ') : '--',
        frac: fracs.length > 0 ? [...new Set(fracs)].join(' / ') : '--',
        irac: iracs.length > 0 ? [...new Set(iracs)].join(' / ') : '--'
    };
}

export async function initModuloDescargas() {
    poblarDesplegableSemanaUnica();
    await asegurarCatalogoTecnico();
    await window.consultarHistorialDescarga();
}

function poblarDesplegableSemanaUnica() {
    const selSemana = document.getElementById('rep-semana-unica');
    if (!selSemana) return;

    const conjuntoSemanas = new Set();
    const anioActual = String(new Date().getFullYear()).slice(-2);
    const anioAnterior = String(Number(anioActual) - 1);

    for (let i = 1; i <= 52; i++) {
        const sem = i < 10 ? `0${i}` : `${i}`;
        conjuntoSemanas.add(`${anioActual}${sem}`);
        conjuntoSemanas.add(`${anioAnterior}${sem}`);
    }

    const semanasOrdenadas = Array.from(conjuntoSemanas).sort((a, b) => b.localeCompare(a));

    let htmlOptions = '<option value="">Todas las semanas...</option>';
    semanasOrdenadas.forEach(sem => {
        htmlOptions += `<option value="${sem}">${sem}</option>`;
    });

    selSemana.innerHTML = htmlOptions;
}

window.consultarHistorialDescarga = async function() {
    const sb = obtenerClienteSupabase();
    const semSeleccionada = document.getElementById('rep-semana-unica')?.value || '';
    const fInicio = document.getElementById('rep-fecha-inicio')?.value || '';
    const fFin = document.getElementById('rep-fecha-fin')?.value || '';
    const tipo = document.getElementById('rep-tipo-app')?.value || '';
    const tbody = document.getElementById('tbody-reporte-historial');
    const lblContador = document.getElementById('rep-contador-registros');

    if (!sb) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-400 font-bold">Error: Supabase no inicializado.</td></tr>`;
        return;
    }

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-emerald-400 font-bold italic animate-pulse">Cruzando historial con fichas técnicas...</td></tr>`;
    }

    try {
        await asegurarCatalogoTecnico();

        const { data, error } = await sb
            .from('rotacion_historico')
            .select('*')
            .order('orden_consecutivo', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-amber-400 font-bold">No hay registros en rotacion_historico aún.</td></tr>`;
            if (lblContador) lblContador.textContent = "0 registros encontrados";
            return;
        }

        const filtrados = data.filter(item => {
            if (tipo && !String(item.tipo_aplicacion || '').toUpperCase().includes(tipo.toUpperCase())) {
                return false;
            }

            const itemSemana = String(item.semana || '').trim();

            if (modoFiltroActual === 'semanas') {
                if (semSeleccionada && itemSemana !== semSeleccionada) {
                    return false;
                }
            } else {
                const fechaEstimada = semanaAFechaAprox(itemSemana) || (item.created_at ? item.created_at.split('T')[0] : '');
                if (fInicio && (!fechaEstimada || fechaEstimada < fInicio)) return false;
                if (fFin && (!fechaEstimada || fechaEstimada > fFin)) return false;
            }

            return true;
        });

        registrosFiltradosCache = filtrados.map(r => {
            const nomProd = String(r.producto || '').trim();
            const datosTec = resolverDatosTecnicos(nomProd);
            const fechaVisual = semanaAFechaAprox(r.semana) || (r.created_at ? r.created_at.split('T')[0] : '--');

            return {
                fecha: fechaVisual,
                semana: r.semana || '--',
                tipo_aplicacion: r.tipo_aplicacion || '--',
                producto: nomProd || '--',
                ingrediente_activo: datosTec.ia,
                frac: datosTec.frac,
                irac: datosTec.irac
            };
        });

        if (lblContador) {
            lblContador.textContent = `${registrosFiltradosCache.length} registros encontrados`;
        }

        if (registrosFiltradosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">No se encontraron registros para el filtro seleccionado.</td></tr>`;
            return;
        }

        tbody.innerHTML = registrosFiltradosCache.map(row => `
            <tr class="hover:bg-slate-700/50 transition">
                <td class="p-3 text-slate-300 font-mono">${row.fecha}</td>
                <td class="p-3 font-bold text-emerald-400 font-mono">${row.semana}</td>
                <td class="p-3 font-semibold text-slate-200">${row.tipo_aplicacion}</td>
                <td class="p-3 font-black text-white">${row.producto}</td>
                <td class="p-3 text-slate-300 text-xs">${row.ingrediente_activo}</td>
                <td class="p-3 text-center"><span class="bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded font-bold">${row.frac}</span></td>
                <td class="p-3 text-center"><span class="bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded font-bold">${row.irac}</span></td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Error al consultar:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-400 font-bold">Error inesperado: ${err.message}</td></tr>`;
        }
    }
};

window.exportarHistorialExcel = function() {
    if (registrosFiltradosCache.length === 0) {
        alert("No hay registros en pantalla para exportar.");
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert("La librería XLSX no está disponible.");
        return;
    }

    const wsData = [
        ["FECHA APROX.", "SEMANA", "TIPO APLICACIÓN", "PRODUCTO / MEZCLA", "INGREDIENTE ACTIVO", "FRAC", "IRAC"]
    ];

    registrosFiltradosCache.forEach(r => {
        wsData.push([r.fecha, r.semana, r.tipo_aplicacion, r.producto, r.ingrediente_activo, r.frac, r.irac]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
        { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rotacion_Historico");
    XLSX.writeFile(wb, `Reporte_Rotacion_${new Date().toISOString().split('T')[0]}.xlsx`);
};

window.exportarHistorialCSV = function() {
    if (registrosFiltradosCache.length === 0) {
        alert("No hay registros para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Fecha;Semana;Tipo Aplicacion;Producto;Ingrediente Activo;FRAC;IRAC\r\n";

    registrosFiltradosCache.forEach(r => {
        csvContent += `${r.fecha};${r.semana};${r.tipo_aplicacion};${r.producto};${r.ingrediente_activo};${r.frac};${r.irac}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Rotacion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};