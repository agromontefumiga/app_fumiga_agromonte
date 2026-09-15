// ============================================================
// MODULO INDEPENDIENTE: HISTORIAL DE PROGRAMAS DE FUMIGACIÓN
// ============================================================

const DB_NAME = 'AgromonteFumigacionDB';
const DB_VERSION = 1;
const STORE_NAME = 'programas_pdf';

function abrirDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'orden' });
                store.createIndex('semana', 'semana', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Guarda o actualiza un PDF en la base de datos local
export async function registrarPDFEnHistorial(registro) {
    try {
        const db = await abrirDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({
            orden: String(registro.orden),
            semana: parseInt(registro.semana, 10) || 0,
            fechaEjecucion: registro.fechaEjecucion || '',
            dirigido: registro.dirigido || 'GENERAL',
            productos: registro.productos || '',
            nombreArchivo: registro.nombreArchivo || `${registro.orden}.pdf`,
            pdfBase64: registro.pdfBase64,
            fechaCreacion: registro.fechaCreacion || new Date().toISOString()
        });
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.warn("No se pudo registrar en el historial local:", e);
        return false;
    }
}
window.registrarPDFEnHistorial = registrarPDFEnHistorial;

// Obtiene todos los programas guardados
export async function consultarTodosProgramas() {
    try {
        const db = await abrirDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        return new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch (e) {
        console.warn("Error leyendo historial local:", e);
        return [];
    }
}
window.consultarTodosProgramas = consultarTodosProgramas;

// ==========================================
// RENDERIZADO Y FILTROS POR SEMANA
// ==========================================
let programasCacheHistorial = [];

export async function cargarVistaHistorial() {
    programasCacheHistorial = await consultarTodosProgramas();
    poblarSelectSemanasDisponibles();
    aplicarFiltroHistorial();
}
window.cargarVistaHistorial = cargarVistaHistorial;

function poblarSelectSemanasDisponibles() {
    const selUnica = document.getElementById('hist-filtro-semana-unica');
    const selDesde = document.getElementById('hist-filtro-semana-desde');
    const selHasta = document.getElementById('hist-filtro-semana-hasta');

    if (!selUnica || !selDesde || !selHasta) return;

    const semanas = [...new Set(programasCacheHistorial.map(p => p.semana))]
        .filter(s => s > 0)
        .sort((a, b) => b - a);

    let opts = '<option value="">Todas las semanas...</option>';
    let optsRango = '<option value="">Seleccione...</option>';

    semanas.forEach(s => {
        opts += `<option value="${s}">${s}</option>`;
        optsRango += `<option value="${s}">${s}</option>`;
    });

    selUnica.innerHTML = opts;
    selDesde.innerHTML = optsRango;
    selHasta.innerHTML = optsRango;
}

window.cambiarModoFiltroHistorial = function(modo) {
    const colUnica = document.getElementById('col-hist-sem-unica');
    const colRango = document.getElementById('col-hist-sem-rango');
    if (!colUnica || !colRango) return;

    if (modo === 'unica') {
        colUnica.classList.remove('hidden');
        colRango.classList.add('hidden');
    } else {
        colUnica.classList.add('hidden');
        colRango.classList.remove('hidden');
    }
};

window.aplicarFiltroHistorial = function() {
    const modo = document.querySelector('input[name="modo-filtro-hist"]:checked')?.value || 'unica';
    const tbody = document.getElementById('tbody-historial-programas-view');
    const contador = document.getElementById('hist-contador-registros');
    if (!tbody) return;

    let filtrados = [...programasCacheHistorial];

    if (modo === 'unica') {
        const sem = parseInt(document.getElementById('hist-filtro-semana-unica')?.value, 10);
        if (sem) {
            filtrados = filtrados.filter(p => p.semana === sem);
        }
    } else {
        const desde = parseInt(document.getElementById('hist-filtro-semana-desde')?.value, 10);
        const hasta = parseInt(document.getElementById('hist-filtro-semana-hasta')?.value, 10);

        if (desde) filtrados = filtrados.filter(p => p.semana >= desde);
        if (hasta) filtrados = filtrados.filter(p => p.semana <= hasta);
    }

    // Ordenar de mayor consecutivo a menor
    filtrados.sort((a, b) => parseInt(b.orden, 10) - parseInt(a.orden, 10));

    if (contador) {
        contador.textContent = `${filtrados.length} orden(es) de fumigación encontrada(s)`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 italic">No se encontraron programas para la búsqueda realizada.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => `
        <tr class="hover:bg-slate-800/80 transition border-b border-slate-700/60 text-xs">
            <td class="p-3">
                <button onclick="abrirPDFHistorialViewer('${p.orden}')" class="text-emerald-400 hover:text-emerald-300 font-mono font-black text-sm underline cursor-pointer">
                    #${p.orden}
                </button>
            </td>
            <td class="p-3 font-bold text-emerald-300 text-sm">${p.semana || '--'}</td>
            <td class="p-3 text-slate-300">${p.fechaEjecucion || '--'}</td>
            <td class="p-3">
                <span class="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-bold text-slate-200">
                    ${p.dirigido || 'GENERAL'}
                </span>
            </td>
            <td class="p-3 text-slate-300 truncate max-w-xs" title="${p.productos}">${p.productos || '--'}</td>
            <td class="p-3 text-center">
                <button onclick="abrirPDFHistorialViewer('${p.orden}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] px-3.5 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 mx-auto cursor-pointer">
                    <span>📄</span> Abrir PDF
                </button>
            </td>
        </tr>
    `).join('');
};

window.abrirPDFHistorialViewer = function(orden) {
    const item = programasCacheHistorial.find(p => String(p.orden) === String(orden));
    if (!item || !item.pdfBase64) {
        alert("No se encontró el archivo del programa seleccionado.");
        return;
    }

    try {
        const arr = item.pdfBase64.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    } catch (err) {
        console.error("Error abriendo el PDF:", err);
        alert("No fue posible previsualizar el PDF.");
    }
};