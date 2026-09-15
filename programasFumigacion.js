import { _supabase } from './config.js';

let datosFumigacionCache = [];
let datosBloquesCache = [];
let datosPersonalCache = [];
let datosObservacionesCache = [];
let datosTiposAplicacionCache = [];
let unidadesMedidaCache = new Map();
let bloquesSeleccionadosFumiga = new Map();
let productosSeleccionadosFumiga = [];
let camasSemanaCache = new Map();
let productosRecomendadosLista = [];

let categoriasBloquesMemoria = {
    vegetativo: [],
    poscosecha: [],
    seccion1: [],
    seccion2: [],
    plantasMadres: []
};

let moduloAcordeonAbiertoId = 'sec-vegetativo';

window.datosFumigacionCache = datosFumigacionCache;

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

const TIPOS_APLICACION_DEFAULT = [
    'FLOR',
    'ÁCAROS',
    'INSECTOS',
    'DESARROLLO',
    'HETERO',
    'AMB 1',
    'AMB 2'
];

const CICLOS_ROTACION = {
    'FLOR': ['ZIGNAL', 'SCALA', 'TELDOR COMBI', 'LUNA TRANQUILITY', 'SWITCH'],
    'ACAROS': ['ACARIBOOM', 'SILI AG', 'VYKENDA', 'ADN MILBE', 'CATOMBE FORTE'],
    'INSECTOS': ['ADN GREEN', 'NILO', 'ACTELLIC', 'ACUAFIN', 'OBLIX'],
    'DESARROLLO': ['KRESSOX', 'ANTRACOL', 'ELEMENT'],
    'HETERO': ['CAPTAN/PYRIPROXYFEN', 'IMPACT/BELT', 'NANKIN/ACUAFIN', 'BANGUARD/ESTOCADA', 'PRAGA/MAGESTIC', 'PRAGA/BELT', 'NANKIN/NILO'],
    'AMB 1': ['ZIGNAL', 'TELDOR COMBI', 'SWITCH', 'LUNA TRANQUILITY', 'SCALA'],
    'AMB 2': ['BANGUARD', 'SCALA', 'ELEMENT', 'SMART SHINE', 'SPORTAK', 'IMPACT']
};

function normalizarTexto(txt) {
    return String(txt || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();
}

function resolverNombreOficial(nombre) {
    let limpio = normalizarTexto(nombre);
    return ALIAS_PRODUCTOS[limpio] || limpio;
}

function formatearNumero(valor) {
    const num = Math.round(Number(valor) || 0);
    return num.toLocaleString('es-CO');
}

function esBloqueSala(nombreBloque) {
    const txt = normalizarTexto(nombreBloque);
    return txt.includes('SALA') || txt.includes('POSCOSECHA');
}

function extraerNumeroBloque(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    const matches = s.match(/\d+/g);
    if (matches && matches.length > 0) {
        return parseInt(matches[0], 10);
    }
    return s.toUpperCase();
}

function sonBloquesEquivalentes(bloqueAgropather, bloqueConfig) {
    const bAgro = String(bloqueAgropather || '').trim().toUpperCase();
    const bCfg = String(bloqueConfig || '').trim().toUpperCase();

    if (!bAgro || !bCfg) return false;
    if (bAgro === bCfg) return true;

    const limpiar = (txt) => txt.replace(/BLOQUE/g, '').replace(/^B/g, '').replace(/[-_]/g, '').trim();
    const cleanAgro = limpiar(bAgro);
    const cleanCfg = limpiar(bCfg);

    if (cleanAgro === cleanCfg) return true;

    const numAgro = parseInt(bAgro.match(/\d+/)?.[0] || '0', 10);
    const numCfg = parseInt(bCfg.match(/\d+/)?.[0] || '0', 10);
    return numAgro > 0 && numAgro === numCfg;
}

function parsearSemanaFiltro(semanaInput) {
    const s = String(semanaInput || '').trim();
    if (!s) return { anio: null, semana: null };

    if (s.length === 4) {
        const yy = parseInt(s.slice(0, 2), 10);
        const ww = parseInt(s.slice(2), 10);
        return { anio: 2000 + yy, semana: ww };
    }
    if (s.length === 6) {
        const yyyy = parseInt(s.slice(0, 4), 10);
        const ww = parseInt(s.slice(4), 10);
        return { anio: yyyy, semana: ww };
    }
    return { anio: null, semana: parseInt(s, 10) };
}

function calcularCodigoSemanaISO(fechaString) {
    if (!fechaString) return '';
    const [anioStr, mesStr, diaStr] = fechaString.split('-');
    const fecha = new Date(Date.UTC(Number(anioStr), Number(mesStr) - 1, Number(diaStr)));

    const diaNum = fecha.getUTCDay() || 7;
    fecha.setUTCDate(fecha.getUTCDate() + 4 - diaNum);

    const anioInicio = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
    const numeroSemana = Math.ceil((((fecha - anioInicio) / 86400000) + 1) / 7);

    const anioDosDigitos = String(fecha.getUTCFullYear()).slice(-2);
    const semanaDosDigitos = numeroSemana < 10 ? `0${numeroSemana}` : `${numeroSemana}`;
    return `${anioDosDigitos}${semanaDosDigitos}`;
}

function obtenerCodigoSemanaRelativa(offsetDias = 0) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + offsetDias);
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return calcularCodigoSemanaISO(`${yyyy}-${mm}-${dd}`);
}

function obtenerFichaCanonico(nombreTexto) {
    if (!nombreTexto || datosFumigacionCache.length === 0) return null;

    const textoLimpio = normalizarTexto(resolverNombreOficial(nombreTexto));
    
    let match = datosFumigacionCache.find(p => normalizarTexto(p.producto) === textoLimpio);
    if (match) return match;

    match = datosFumigacionCache.find(p => {
        const nomBd = normalizarTexto(p.producto);
        return nomBd.startsWith(textoLimpio + ' ') || nomBd.startsWith(textoLimpio);
    });
    if (match) return match;

    const palabras = textoLimpio.split(' ').filter(w => w.length > 2);
    if (palabras.length > 0) {
        match = datosFumigacionCache.find(p => {
            const nomBd = normalizarTexto(p.producto);
            return palabras.every(token => nomBd.includes(token));
        });
        if (match) return match;
    }

    match = datosFumigacionCache.find(p => {
        const nomBd = normalizarTexto(p.producto);
        return nomBd.includes(textoLimpio) || textoLimpio.includes(nomBd);
    });

    return match || null;
}

function encontrarFichaProducto(nombreProd) {
    return obtenerFichaCanonico(nombreProd);
}

// ==========================================
// 1. INICIALIZACIÓN DEL MÓDULO
// ==========================================
export async function initProgramasFumigacion() {
    console.log("Iniciando módulo de Programas de Fumigación...");
    try {
        inyectarEstilosImpresionLandscape();
        removerCamposConfiguracionInformativos();
        
        await Promise.allSettled([
            cargarCatalogoFumigaciones(),
            cargarCatalogoBloques(),
            cargarPersonalNelson(),
            cargarObservacionesFumigacion(),
            cargarUnidadesMedidaAlmacen(),
            cargarTiposAplicacion(),
            obtenerSiguienteConsecutivoFumigacion()
        ]);
        
        poblarDesplegablesPrograma();
        configurarBuscadorProductosAlfabetico();
        configurarCambioSemana();
        await inicializarFechasYObservaciones();
        reestructurarPantallaCompleta();
        renderizarPanelControlBloques();
        asegurarLogoEmpresa();
        conectarSugerenciaPorTipoAplicacion();
        actualizarMatrizCalculos();

        suscribirCambiosEnTiempoReal();

        console.log("Módulo de fumigación inicializado con éxito.");
    } catch (err) {
        console.error("Error al inicializar fumigaciones:", err);
    }
}

window.initProgramasFumigacion = initProgramasFumigacion;

function removerCamposConfiguracionInformativos() {
    const idsRemover = [
        'inp-blanco',
        'inp-solicito',
        'inp-aprobo',
        'lista-blancos'
    ];

    idsRemover.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const contenedorCol = el.closest('.flex-col') || el.closest('div') || el;
            if (contenedorCol && contenedorCol.parentElement && contenedorCol !== document.body) {
                contenedorCol.remove();
            } else {
                el.remove();
            }
        }
    });

    const labels = document.querySelectorAll('label');
    labels.forEach(lbl => {
        const txt = normalizarTexto(lbl.textContent);
        if (txt.includes('BLANCO BIOLOGICO') || txt.includes('SOLICITO') || txt.includes('APROBO')) {
            const cont = lbl.closest('.flex-col') || lbl.parentElement;
            if (cont) cont.remove();
        }
    });
}

function inyectarEstilosImpresionLandscape() {
    if (document.getElementById('print-landscape-style')) return;
    const style = document.createElement('style');
    style.id = 'print-landscape-style';
    style.innerHTML = `
        .modo-exportacion-pdf {
            width: 960px !important;
            max-width: 960px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 3mm 5mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
        }

        .modo-exportacion-pdf h2 {
            font-size: 14pt !important;
            margin-bottom: 2px !important;
            line-height: 1 !important;
        }

        .modo-exportacion-pdf p {
            margin: 0 !important;
            line-height: 1.15 !important;
        }

        /* 1. TABLA DE BLOQUES Y CAMAS: FUERTE, GRANDE Y VISIBLE */
        .modo-exportacion-pdf table.tabla-bloques-ampliada {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 9pt !important;
            margin-bottom: 3mm !important;
        }

        .modo-exportacion-pdf table.tabla-bloques-ampliada td {
            border: 1px solid #475569 !important;
            padding: 4px 2px !important;
            line-height: 1.15 !important;
            font-size: 9pt !important;
            font-weight: 700 !important;
        }

        /* 2. TABLA INFERIOR DE PRODUCTOS */
        .modo-exportacion-pdf table.tabla-detalle-prods {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 6.8pt !important;
            margin-bottom: 2mm !important;
        }

        .modo-exportacion-pdf table.tabla-detalle-prods th,
        .modo-exportacion-pdf table.tabla-detalle-prods td {
            border: 0.5px solid #94a3b8 !important;
            padding: 2px 2px !important;
            line-height: 1.1 !important;
            word-break: break-word !important;
        }

        .modo-exportacion-pdf table.tabla-detalle-prods th {
            background-color: #065f46 !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            font-size: 6.5pt !important;
        }

        .modo-exportacion-pdf #reporte-observaciones-custom {
            margin-top: 1.5mm !important;
            margin-bottom: 2mm !important;
            padding: 2mm 3mm !important;
            border: 0.5px solid #94a3b8 !important;
            background-color: #f8fafc !important;
            font-size: 8.5pt !important;
        }

        @media print {
            @page {
                size: letter landscape;
                margin: 4mm;
            }
            body, html {
                background-color: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: 100% !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            body * {
                visibility: hidden !important;
            }
            #reporte-programa, #reporte-programa * {
                visibility: visible !important;
            }
            #reporte-programa {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 2mm !important;
                box-shadow: none !important;
                transform: scale(0.92) !important;
                transform-origin: top left !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// ==========================================
// 2. CARGA DINÁMICA DE PRODUCTOS Y TABLAS
// ==========================================
async function cargarCatalogoFumigaciones() {
    try {
        const [resRotacion, resFumiga] = await Promise.allSettled([
            _supabase.from('rotacion_productos').select('*'),
            _supabase.from('productos_fumigacion').select('*')
        ]);

        const prodsRotacion = resRotacion.status === 'fulfilled' && resRotacion.value.data ? resRotacion.value.data : [];
        const prodsFumiga = resFumiga.status === 'fulfilled' && resFumiga.value.data ? resFumiga.value.data : [];

        const mapa = new Map();

        prodsRotacion.forEach(item => {
            const nomExacto = String(item.producto || '').trim();
            if (nomExacto) {
                const clave = normalizarTexto(nomExacto);
                mapa.set(clave, {
                    producto: nomExacto,
                    registro_ica: item.registro_ica || '--',
                    ingrediente_activo: item.ingrediente_activo || '--',
                    categoria_toxicologica: item.cat_toxicologica || item.categoria_toxicologica || '--',
                    concentracion_ia: item.porcentaje_ingrediente_activo || item.concentracion_ia || '--',
                    tiempo_reingreso: item.tiempo_reingreso || '--',
                    blanco_biologico: item.blanco_biologico || '',
                    dosis: item.dosis_cc_grs || item.dosis || '',
                    irac: item.irac !== null && item.irac !== undefined && item.irac !== '' ? String(item.irac).trim() : '--',
                    frac: item.frac !== null && item.frac !== undefined && item.frac !== '' ? String(item.frac).trim() : '--'
                });
            }
        });

        prodsFumiga.forEach(item => {
            const nomExacto = String(item.producto || '').trim();
            if (nomExacto) {
                const clave = normalizarTexto(nomExacto);
                if (!mapa.has(clave)) {
                    mapa.set(clave, {
                        producto: nomExacto,
                        registro_ica: item.registro_ica || '--',
                        ingrediente_activo: item.ingrediente_activo || '--',
                        categoria_toxicologica: item.categoria_toxicologica || item.cat_toxicologica || '--',
                        concentracion_ia: item.concentracion_ia || item.porcentaje_ingrediente_activo || '--',
                        tiempo_reingreso: item.tiempo_reingreso || '--',
                        blanco_biologico: item.blanco_biologico || '',
                        dosis: item.dosis || item.dosis_cc_grs || '',
                        irac: item.irac !== null && item.irac !== undefined && item.irac !== '' ? String(item.irac).trim() : '--',
                        frac: item.frac !== null && item.frac !== undefined && item.frac !== '' ? String(item.frac).trim() : '--'
                    });
                } else {
                    const existente = mapa.get(clave);
                    if (existente.registro_ica === '--' && item.registro_ica) existente.registro_ica = item.registro_ica;
                    if (existente.ingrediente_activo === '--' && item.ingrediente_activo) existente.ingrediente_activo = item.ingrediente_activo;
                    if (existente.dosis === '' && (item.dosis || item.dosis_cc_grs)) existente.dosis = item.dosis || item.dosis_cc_grs;
                }
            }
        });

        datosFumigacionCache = Array.from(mapa.values()).sort((a, b) => a.producto.localeCompare(b.producto));
        window.datosFumigacionCache = datosFumigacionCache;
        console.log(`Catálogo cargado: ${datosFumigacionCache.length} productos listos desde BD.`);
    } catch (err) {
        console.error("Error al cargar catálogo de productos:", err);
    }
}

async function cargarCatalogoBloques() {
    try {
        const { data, error } = await _supabase.from('config_bloques').select('*');
        if (error) throw error;
        datosBloquesCache = data || [];
        console.log(`Bloques cargados desde config_bloques: ${datosBloquesCache.length}`);

        datosBloquesCache.forEach(b => {
            const nom = String(b.config_agropather || b.nombre_bloque || b.bloque || b.nombre || '').trim();
            if (esBloqueSala(nom)) {
                camasSemanaCache.set(nom, 1);
            }
        });
    } catch (err) {
        console.error("Error consultando config_bloques:", err);
    }
}

async function cargarPersonalNelson() {
    try {
        const { data, error } = await _supabase.rpc('obtener_fumigadores_nelson');
        if (error) throw error;

        if (data && data.length > 0) {
            datosPersonalCache = data.map(item => {
                const nombreCompleto = item.nombre || item.nombres || `${item.primer_nombre || ''} ${item.primer_apellido || ''}`.trim();
                return { nombre: nombreCompleto || 'Operario' };
            });
        } else {
            datosPersonalCache = [];
        }
    } catch (err) {
        console.warn("Error cargando personal:", err);
        datosPersonalCache = [];
    }
    actualizarPieReporte();
}

async function cargarObservacionesFumigacion() {
    try {
        const { data, error } = await _supabase
            .from('obs_fumigacion')
            .select('observacion')
            .order('observacion', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            const unicas = [...new Set(data.map(d => String(d.observacion || '').trim()))].filter(Boolean);
            datosObservacionesCache = unicas.map(obs => ({ observacion: obs }));
        } else {
            datosObservacionesCache = [];
        }
        
        console.log(`Observaciones cargadas desde obs_fumigacion: ${datosObservacionesCache.length}`);
        poblarSelectObservaciones();
    } catch (err) {
        console.warn("Error cargando obs_fumigacion:", err);
        datosObservacionesCache = [];
        poblarSelectObservaciones();
    }
}

async function cargarTiposAplicacion() {
    try {
        const { data, error } = await _supabase.from('aplicacion_fumigacion').select('tipo');
        if (!error && data && data.length > 0) {
            datosTiposAplicacionCache = data;
        } else {
            datosTiposAplicacionCache = TIPOS_APLICACION_DEFAULT.map(t => ({ tipo: t }));
        }
    } catch (err) {
        datosTiposAplicacionCache = TIPOS_APLICACION_DEFAULT.map(t => ({ tipo: t }));
    }
    poblarSelectDirigido();
}

async function cargarUnidadesMedidaAlmacen() {
    try {
        const { data, error } = await _supabase.from('almacen_articulos').select('*');
        if (error) throw error;
        if (data) {
            unidadesMedidaCache.clear();
            data.forEach(item => {
                const nombre = String(item.nombre || item.articulo || item.producto || '').trim().toUpperCase();
                const unidadMedidaColumna = String(item.unidad_medida || '').trim().toLowerCase();
                
                if (nombre) {
                    let normalizada = 'cc';
                    if (unidadMedidaColumna.includes('gr') || unidadMedidaColumna.includes('g') || unidadMedidaColumna.includes('k') || unidadMedidaColumna.includes('gramo') || unidadMedidaColumna.includes('kilogramo')) {
                        normalizada = 'grs';
                    }
                    unidadesMedidaCache.set(nombre, normalizada);
                }
            });
        }
    } catch (err) {
        console.warn("No se pudo cargar almacen_articulos:", err);
    }
}

async function obtenerSiguienteConsecutivoFumigacion() {
    try {
        const { data, error } = await _supabase
            .from('historial_fumigaciones')
            .select('orden')
            .order('orden', { ascending: false })
            .limit(1);

        let siguienteOrden = 21000;

        if (!error && data && data.length > 0) {
            const ultimoOrden = parseInt(data[0].orden, 10);
            if (!isNaN(ultimoOrden) && ultimoOrden >= 21000) {
                siguienteOrden = ultimoOrden + 1;
            }
        }

        const programasLocales = await obtenerTodosProgramasPDF();
        if (programasLocales.length > 0) {
            const maxLocal = Math.max(...programasLocales.map(p => parseInt(p.orden, 10) || 0));
            if (maxLocal >= siguienteOrden) {
                siguienteOrden = maxLocal + 1;
            }
        }

        const lblOrden = document.getElementById('lbl-orden');
        if (lblOrden) lblOrden.textContent = siguienteOrden;
    } catch (err) {
        const lblOrden = document.getElementById('lbl-orden');
        if (lblOrden) lblOrden.textContent = '21000';
    }
}

export function obtenerUnidadRealProducto(nombreProducto) {
    const nombre = String(nombreProducto || '').trim().toUpperCase();
    
    for (let [key, val] of unidadesMedidaCache.entries()) {
        if (nombre === key || nombre.includes(key) || key.includes(nombre)) {
            if (val === 'grs') return 'grs';
        }
    }

    const nomenclaturasGramos = ['SP', 'WG', 'WP', 'GR', 'G,', 'GS', 'GMS', 'GRS', 'KG', 'GRAMOS', 'POLVO', 'SOLUBLE'];
    if (nomenclaturasGramos.some(sigla => nombre.includes(sigla))) {
        return 'grs';
    }

    return 'cc';
}

// ==========================================
// 3. PANELES Y CONFIGURACIÓN (SEMANAS LIMPIAS)
// ==========================================
function poblarDesplegablesPrograma() {
    const selSemana = document.getElementById("inp-semana");
    if (selSemana) {
        const valorActual = selSemana.value;
        
        // Generar SOLO los dos números limpios de semana (ej: 2638 y 2639)
        const semActual = String(obtenerCodigoSemanaRelativa(0));
        const semSiguiente = String(obtenerCodigoSemanaRelativa(7));

        selSemana.innerHTML = `
            <option value="">Seleccione...</option>
            <option value="${semActual}">${semActual}</option>
            <option value="${semSiguiente}">${semSiguiente}</option>
        `;

        if (valorActual === semSiguiente) {
            selSemana.value = semSiguiente;
        } else {
            selSemana.value = semActual;
        }
    }

    poblarSelectObservaciones();
    poblarSelectDirigido();
    reestructurarPantallaCompleta();
    renderizarPanelControlBloques();
}

function poblarSelectObservaciones() {
    const selObs = document.getElementById('inp-observacion');
    if (!selObs) return;

    const valorActual = selObs.value;
    let htmlOptions = '<option value="">Seleccione observación...</option>';
    
    const unicasObs = [...new Set(datosObservacionesCache.map(item => item.observacion))].filter(Boolean).sort();
    unicasObs.forEach(obs => {
        htmlOptions += `<option value="${obs}">${obs}</option>`;
    });

    selObs.innerHTML = htmlOptions;
    if (valorActual && unicasObs.includes(valorActual)) {
        selObs.value = valorActual;
    }

    selObs.onchange = () => {
        actualizarMatrizCalculos();
    };
}

function poblarSelectDirigido() {
    const selDirigido = document.getElementById('inp-dirigido');
    if (!selDirigido) return;

    const valorActual = selDirigido.value;
    let htmlOptions = '<option value="">Seleccione tipo...</option>';
    
    let opciones = (datosTiposAplicacionCache || []).map(i => i.tipo).filter(Boolean);
    if (opciones.length === 0) {
        opciones = TIPOS_APLICACION_DEFAULT;
    }

    const tiposUnicos = [...new Set(opciones)].sort();
    tiposUnicos.forEach(tipo => {
        htmlOptions += `<option value="${tipo}">${tipo}</option>`;
    });

    selDirigido.innerHTML = htmlOptions;
    if (valorActual) selDirigido.value = valorActual;
}

function reestructurarPantallaCompleta() {
    const gridBloques = document.getElementById('grid-bloques');
    if (gridBloques) {
        let contenedorPadre = gridBloques.parentElement;
        while (contenedorPadre && !contenedorPadre.classList.contains('bg-slate-900') && !contenedorPadre.id && contenedorPadre.parentElement) {
            contenedorPadre = contenedorPadre.parentElement;
        }
        if (contenedorPadre) {
            contenedorPadre.style.maxWidth = '100%';
            contenedorPadre.style.width = '100%';
        }
    }
}

// Sincroniza semana únicamente si coincide con las opciones actuales sin sobreescribir con textos
async function sincronizarSemanaDesdeFechaElaboracion(fechaValor) {
    const selSemana = document.getElementById('inp-semana');
    if (!selSemana || !fechaValor) return;

    const semanaCalculada = calcularCodigoSemanaISO(fechaValor);
    if (semanaCalculada) {
        let existe = Array.from(selSemana.options).some(opt => opt.value === semanaCalculada);
        if (!existe) {
            // Si la fecha cae en otra semana, la añade como número limpio
            selSemana.innerHTML += `<option value="${semanaCalculada}">${semanaCalculada}</option>`;
        }
        selSemana.value = semanaCalculada;
        await dispararRecalculoPorSemana(semanaCalculada);
    }
}

async function inicializarFechasYObservaciones() {
    const hoy = new Date().toISOString().split('T')[0];

    const inpElab = document.getElementById('inp-fecha-elaboracion');
    if (inpElab && !inpElab.value) inpElab.value = hoy;

    const inpEjec = document.getElementById('inp-fecha-ejecucion');
    if (inpEjec && !inpEjec.value) inpEjec.value = hoy;

    if (inpElab) {
        inpElab.onclick = () => {
            if (typeof inpElab.showPicker === 'function') {
                try { inpElab.showPicker(); } catch (e) {}
            }
        };
        inpElab.onchange = async () => {
            await sincronizarSemanaDesdeFechaElaboracion(inpElab.value);
            actualizarMatrizCalculos();
        };
        await sincronizarSemanaDesdeFechaElaboracion(inpElab.value);
    }

    if (inpEjec) {
        inpEjec.onclick = () => {
            if (typeof inpEjec.showPicker === 'function') {
                try { inpEjec.showPicker(); } catch (e) {}
            }
        };
        inpEjec.onchange = () => actualizarMatrizCalculos();
    }

    reestructurarPantallaCompleta();
}

function asegurarLogoEmpresa() {
    const reporteContainer = document.getElementById('reporte-programa');
    if (!reporteContainer) return;

    let headerReporte = reporteContainer.querySelector('.flex.justify-between.items-center') || reporteContainer.querySelector('div:first-child');
    if (headerReporte && !document.getElementById('logo-empresa-reporte')) {
        const divLogo = document.createElement('div');
        divLogo.className = 'flex items-center gap-3';
        divLogo.innerHTML = `<img id="logo-empresa-reporte" src="./logo.png" alt="Logo" class="h-10 w-auto object-contain" onerror="this.style.display='none'">`;
        headerReporte.insertBefore(divLogo, headerReporte.firstChild);
    }
}

window.toggleAcordeonSeccion = function(idSeccion) {
    if (moduloAcordeonAbiertoId === idSeccion) {
        moduloAcordeonAbiertoId = null;
    } else {
        moduloAcordeonAbiertoId = idSeccion;
    }

    const todosAcordeones = document.querySelectorAll('.acordeon-contenido-bloque');
    const todosIconos = document.querySelectorAll('.acordeon-icono-bloque');

    todosAcordeones.forEach(sec => sec.classList.add('hidden'));
    todosIconos.forEach(ic => ic.style.transform = 'rotate(0deg)');

    if (moduloAcordeonAbiertoId) {
        const target = document.getElementById(moduloAcordeonAbiertoId);
        const targetIcono = document.getElementById(`icon-${moduloAcordeonAbiertoId}`);
        if (target) target.classList.remove('hidden');
        if (targetIcono) targetIcono.style.transform = 'rotate(180deg)';
    }
};

window.toggleSeleccionarTodosBloquesModulo = function(claveCategoria) {
    const lista = categoriasBloquesMemoria[claveCategoria] || [];
    if (lista.length === 0) return;

    const todosSeleccionados = lista.every(item => {
        const nom = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || '').trim();
        return bloquesSeleccionadosFumiga.has(nom);
    });

    if (todosSeleccionados) {
        lista.forEach(item => {
            const nom = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || '').trim();
            bloquesSeleccionadosFumiga.delete(nom);
        });
    } else {
        lista.forEach(item => {
            const nom = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || '').trim();
            let camas = esBloqueSala(nom) ? 1 : 0;
            if (camasSemanaCache.has(nom)) {
                camas = camasSemanaCache.get(nom);
            }
            if (camas === 0 || isNaN(camas)) {
                camas = 1;
            }
            bloquesSeleccionadosFumiga.set(nom, camas);
        });
    }

    renderizarPanelControlBloques();
    actualizarMatrizCalculos();
};

function renderizarPanelControlBloques() {
    const gridB = document.getElementById("grid-bloques");
    if (!gridB || datosBloquesCache.length === 0) return;

    if (gridB.parentElement) {
        gridB.parentElement.style.maxHeight = 'none';
        gridB.parentElement.style.overflowY = 'visible';
        gridB.parentElement.style.width = '100%';
    }

    const bloquesOrdenados = [...datosBloquesCache].sort((a, b) => {
        const strA = String(a.config_agropather || a.nombre_bloque || a.bloque || a.nombre || '');
        const strB = String(b.config_agropather || b.nombre_bloque || b.bloque || b.nombre || '');
        const numsA = strA.match(/\d+/g)?.map(Number) || [0];
        const numsB = strB.match(/\d+/g)?.map(Number) || [0];

        if (numsA[0] !== numsB[0]) return numsA[0] - numsB[0];
        return (numsA[1] || 0) - (numsB[1] || 0);
    });

    let vegetativo = [];
    let seccion1 = [];
    let seccion2 = [];
    let plantasMadres = [];
    let poscosecha = [];

    const BLOQUES_VEGETATIVO = ['B01', 'B1', '1', 'B07_2', 'B07.2', '7.2', 'B7_2', 'B08', 'B8', '8'];

    bloquesOrdenados.forEach(item => {
        const nombre = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || '').trim();
        const nombreUpper = nombre.toUpperCase();
        const nombreLower = nombre.toLowerCase();
        const nums = nombre.match(/\d+/g)?.map(Number) || [0];
        const numPrincipal = nums[0] || 0;

        const coincideVegetativo = BLOQUES_VEGETATIVO.some(bv => {
            return nombreUpper === bv || 
                   nombreUpper === `BLOQUE ${bv}` || 
                   nombreUpper.replace(/[-_.]/g, '') === bv.replace(/[-_.]/g, '');
        });

        if (coincideVegetativo) {
            vegetativo.push(item);
        } else if (nombreLower.includes('poscosecha') || nombreLower.includes('sala')) {
            poscosecha.push(item);
        } else if (numPrincipal === 90 || numPrincipal === 91 || numPrincipal === 92 || nombreLower.includes('madre') || nombreLower.includes('pm')) {
            plantasMadres.push(item);
        } else if (numPrincipal >= 1 && numPrincipal <= 14) {
            seccion1.push(item);
        } else {
            seccion2.push(item);
        }
    });

    categoriasBloquesMemoria = {
        vegetativo,
        poscosecha,
        seccion1,
        seccion2,
        plantasMadres
    };

    function generarHtmlBloques(lista) {
        return lista.map(item => {
            const nombreBloque = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || 'Sin Nombre');
            
            let camas = esBloqueSala(nombreBloque) ? 1 : 0;

            if (bloquesSeleccionadosFumiga.has(nombreBloque)) {
                camas = bloquesSeleccionadosFumiga.get(nombreBloque);
            } else if (camasSemanaCache.has(nombreBloque)) {
                camas = camasSemanaCache.get(nombreBloque);
            }

            if (esBloqueSala(nombreBloque) && (camas === 0 || isNaN(camas))) {
                camas = 1;
            }

            const estaSeleccionado = bloquesSeleccionadosFumiga.has(nombreBloque);
            const clasesContenedor = estaSeleccionado 
                ? "p-2.5 bg-emerald-950 border border-emerald-500 rounded-lg text-white font-bold transition flex flex-col items-center shadow-md cursor-pointer"
                : "p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-bold hover:bg-slate-800 transition flex flex-col items-center cursor-pointer";

            const nombreEscapado = nombreBloque.replace(/'/g, "\\'");
            return `
                <div class="${clasesContenedor}" onclick="toggleBloqueFumigacion('${nombreEscapado}', ${camas})">
                    <span class="text-xs uppercase font-black mb-1.5 w-full text-center hover:text-emerald-400">
                        ${nombreBloque}
                    </span>
                    <div class="flex items-center gap-1 w-full justify-center" onclick="event.stopPropagation()">
                        <span class="text-[10px] text-slate-400">Camas:</span>
                        <input type="number" value="${camas}" onchange="modificarCamasPanelArriba('${nombreEscapado}', this.value)" class="w-12 bg-slate-900 border border-slate-600 rounded text-center text-emerald-300 font-bold text-xs p-1 outline-none focus:border-emerald-500">
                    </div>
                </div>
            `;
        }).join('');
    }

    function crearAcordeonHtml(id, titulo, colorBg, claveCategoria, listaItems) {
        if (listaItems.length === 0) return '';
        
        const estaAbierto = (moduloAcordeonAbiertoId === id);
        const hiddenClass = estaAbierto ? '' : 'hidden';
        const rotateStyle = estaAbierto ? 'transform: rotate(180deg);' : 'transform: rotate(0deg);';

        const seleccionadosCount = listaItems.filter(item => {
            const nom = String(item.config_agropather || item.nombre_bloque || item.bloque || item.nombre || '').trim();
            return bloquesSeleccionadosFumiga.has(nom);
        }).length;

        const todosActivos = seleccionadosCount === listaItems.length && listaItems.length > 0;
        const textoBoton = todosActivos ? '☒ Deseleccionar' : '☑ Seleccionar Todos';
        const claseBoton = todosActivos 
            ? 'bg-rose-700 hover:bg-rose-600 text-white' 
            : 'bg-emerald-950 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50';

        return `
            <div class="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/60 shadow-md">
                <div onclick="toggleAcordeonSeccion('${id}')" class="w-full flex items-center justify-between p-3 ${colorBg} text-white font-bold text-xs uppercase tracking-wider transition hover:opacity-95 cursor-pointer select-none">
                    <span class="flex items-center gap-2">
                        <span>📂</span> ${titulo} 
                        <span class="text-[11px] font-normal opacity-90">(${seleccionadosCount}/${listaItems.length} activos)</span>
                    </span>
                    
                    <div class="flex items-center gap-3">
                        <button type="button" 
                                onclick="event.stopPropagation(); toggleSeleccionarTodosBloquesModulo('${claveCategoria}')" 
                                class="px-2.5 py-1 rounded text-[10px] font-black transition shadow-sm ${claseBoton}">
                            ${textoBoton}
                        </button>
                        <span id="icon-${id}" style="transition: transform 0.2s; ${rotateStyle}" class="acordeon-icono-bloque text-sm font-bold">▼</span>
                    </div>
                </div>
                <div id="${id}" class="acordeon-contenido-bloque ${hiddenClass} p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3 bg-slate-900/90 border-t border-slate-800">
                    ${generarHtmlBloques(listaItems)}
                </div>
            </div>
        `;
    }

    gridB.className = "w-full";
    gridB.innerHTML = `
        <div class="text-slate-400 text-xs mb-2 italic">Haz clic en un módulo para abrirlo o usa el botón para marcar todos los bloques del grupo:</div>
        <div class="space-y-3 w-full">
            ${crearAcordeonHtml('sec-vegetativo', 'Vegetativo', 'bg-teal-700 hover:bg-teal-600', 'vegetativo', vegetativo)}
            ${crearAcordeonHtml('sec-poscosecha', 'Poscosecha / Salas', 'bg-amber-700 hover:bg-amber-600', 'poscosecha', poscosecha)}
            ${crearAcordeonHtml('sec-01-14', 'Bloques del 01 al 14', 'bg-emerald-700 hover:bg-emerald-600', 'seccion1', seccion1)}
            ${crearAcordeonHtml('sec-15-19', 'Bloques del 15 al 19', 'bg-blue-700 hover:bg-blue-600', 'seccion2', seccion2)}
            ${crearAcordeonHtml('sec-madres', 'Plantas Madres', 'bg-purple-700 hover:bg-purple-600', 'plantasMadres', plantasMadres)}
        </div>
    `;
}

async function dispararRecalculoPorSemana(semanaSeleccionada) {
    camasSemanaCache.clear();

    if (datosBloquesCache && datosBloquesCache.length > 0) {
        datosBloquesCache.forEach(b => {
            const nomBloque = String(b.config_agropather || b.nombre_bloque || b.bloque || b.nombre || '').trim();
            if (esBloqueSala(nomBloque)) {
                camasSemanaCache.set(nomBloque, 1);
            }
        });
    }

    const filtro = parsearSemanaFiltro(semanaSeleccionada);

    if (filtro.semana !== null && !isNaN(filtro.semana)) {
        try {
            let query = _supabase
                .from('agropather')
                .select('ano, semana, bloque, camas_monitoreadas, config_bloques')
                .eq('semana', filtro.semana);

            if (filtro.anio) {
                query = query.eq('ano', filtro.anio);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                data.forEach(reg => {
                    const regBloque = String(reg.bloque || '').trim();
                    const idConfigRel = reg.config_bloques !== undefined && reg.config_bloques !== null ? String(reg.config_bloques).trim() : '';
                    const camasMon = Number(reg.camas_monitoreadas) || 0;

                    if (camasMon > 0) {
                        datosBloquesCache.forEach(b => {
                            const nomBloque = String(b.config_agropather || b.nombre_bloque || '').trim();
                            
                            if (esBloqueSala(nomBloque)) {
                                camasSemanaCache.set(nomBloque, 1);
                                return;
                            }

                            const idAgro = String(b.config_agropather || '').trim();
                            const nomVis = String(b.nombre_bloque || '').trim();
                            const bId = String(b.id || '').trim();

                            const coincide = (idConfigRel && (idConfigRel === bId || idConfigRel === idAgro)) ||
                                             sonBloquesEquivalentes(regBloque, idAgro) ||
                                             sonBloquesEquivalentes(regBloque, nomVis) ||
                                             extraerNumeroBloque(nomBloque) === extraerNumeroBloque(regBloque);

                            if (coincide) {
                                const actual = camasSemanaCache.get(nomBloque) || 0;
                                if (camasMon > actual) {
                                    camasSemanaCache.set(nomBloque, camasMon);
                                }
                            }
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Error al consultar camas en agropather:", err);
        }
    }

    bloquesSeleccionadosFumiga.forEach((_, nomBloque) => {
        if (camasSemanaCache.has(nomBloque)) {
            bloquesSeleccionadosFumiga.set(nomBloque, camasSemanaCache.get(nomBloque));
        }
    });

    renderizarPanelControlBloques();
    actualizarMatrizCalculos();
}

function configurarCambioSemana() {
    const selSemana = document.getElementById("inp-semana");
    if (!selSemana) return;

    selSemana.onchange = async (e) => {
        await dispararRecalculoPorSemana(e.target.value);
    };
}

window.toggleBloqueFumigacion = function(bloque, camasSugeridas) {
    if (bloquesSeleccionadosFumiga.has(bloque)) {
        bloquesSeleccionadosFumiga.delete(bloque);
    } else {
        let camasFinales = camasSugeridas;
        if (camasFinales === 0 && camasSemanaCache.has(bloque)) {
            camasFinales = camasSemanaCache.get(bloque);
        }
        if (esBloqueSala(bloque)) {
            camasFinales = 1;
        }
        bloquesSeleccionadosFumiga.set(bloque, camasFinales > 0 ? camasFinales : 1);
    }
    renderizarPanelControlBloques();
    actualizarMatrizCalculos();
};

window.modificarCamasPanelArriba = function(bloque, nuevasCamas) {
    const numCamas = Number(nuevasCamas) || 0;
    if (numCamas > 0) {
        bloquesSeleccionadosFumiga.set(bloque, numCamas);
    } else {
        bloquesSeleccionadosFumiga.delete(bloque);
    }
    renderizarPanelControlBloques();
    actualizarMatrizCalculos();
};

// ==========================================
// 4. BUSCADOR DINÁMICO DE PRODUCTOS (A - Z)
// ==========================================
function configurarBuscadorProductosAlfabetico() {
    const contenedorInput = document.getElementById('buscador-productos');
    if (!contenedorInput) return;

    const parentFormGrid = contenedorInput.closest('.grid') || contenedorInput.parentElement.parentElement;
    if (!parentFormGrid) return;

    const wrapperId = 'buscador-alfabetico-grid-wrapper';
    if (document.getElementById(wrapperId)) return;

    const divContenedorGeneral = document.createElement('div');
    divContenedorGeneral.id = wrapperId;
    divContenedorGeneral.className = 'col-span-full flex flex-col gap-2 mt-3 pt-3 border-t border-slate-700/60 w-full';

    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    let botonesHtml = `
        <div class="flex flex-col gap-1.5 w-full">
            <span class="text-xs font-bold text-slate-300 uppercase">Filtrar Productos por Letra (A - Z):</span>
            <div class="flex flex-wrap gap-1 bg-slate-900/80 p-2.5 rounded-lg border border-slate-700">
    `;
    
    letras.forEach(letra => {
        botonesHtml += `<button type="button" onclick="filtrarProductosPorLetra('${letra}')" class="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs rounded border border-slate-600 transition">${letra}</button>`;
    });
    
    botonesHtml += `
            </div>
        </div>
        <div id="lista-productos-letra" class="hidden bg-slate-800 border border-slate-700 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 w-full"></div>
    `;

    divContenedorGeneral.innerHTML = botonesHtml;

    contenedorInput.style.display = 'none';
    const labelBusqueda = contenedorInput.previousElementSibling;
    if (labelBusqueda && labelBusqueda.tagName === 'LABEL') {
        labelBusqueda.style.display = 'none';
    }
    const dropAntiguo = document.getElementById('dropdown-productos');
    if (dropAntiguo) dropAntiguo.style.display = 'none';

    parentFormGrid.appendChild(divContenedorGeneral);
}

window.filtrarProductosPorLetra = function(letra) {
    const contenedorLista = document.getElementById('lista-productos-letra');
    if (!contenedorLista) return;

    const productosFiltrados = [...new Set(datosFumigacionCache.map(i => i.producto))]
        .filter(p => p && normalizarTexto(p).startsWith(letra))
        .sort((a, b) => a.localeCompare(b));

    if (productosFiltrados.length === 0) {
        contenedorLista.innerHTML = `<div class="text-xs text-slate-400 italic p-2 text-center">No hay productos con la letra "${letra}"</div>`;
        contenedorLista.classList.remove('hidden');
        return;
    }

    contenedorLista.innerHTML = productosFiltrados.map(prod => {
        const prodEscapado = prod.replace(/'/g, "\\'");
        return `
            <div onclick="seleccionarProductoProgramaAlfabetico('${prodEscapado}')" class="p-2 hover:bg-emerald-950 hover:text-emerald-300 cursor-pointer text-white font-bold text-xs rounded transition flex justify-between items-center border-b border-slate-700 last:border-none">
                <span>${prod}</span>
                <span class="text-[10px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded font-bold">Seleccionar +</span>
            </div>
        `;
    }).join('');

    contenedorLista.classList.remove('hidden');
};

window.seleccionarProductoProgramaAlfabetico = function(prod) {
    const container = document.getElementById('productos-seleccionados-container');
    const contenedorLista = document.getElementById('lista-productos-letra');

    if (contenedorLista) contenedorLista.classList.add('hidden');

    const ficha = obtenerFichaCanonico(prod);
    const nombreFinal = ficha ? ficha.producto : resolverNombreOficial(prod);

    if (!productosSeleccionadosFumiga.some(p => normalizarTexto(p.nombre) === normalizarTexto(nombreFinal))) {
        const dosisVal = ficha && ficha.dosis && ficha.dosis !== '--' ? parseFloat(ficha.dosis) : '';
        const unidadReal = obtenerUnidadRealProducto(nombreFinal);

        productosSeleccionadosFumiga.push({ 
            nombre: nombreFinal,
            registro_ica: ficha?.registro_ica || '--',
            ingrediente_activo: ficha?.ingrediente_activo || '--',
            categoria_toxicologica: ficha?.categoria_toxicologica || '--',
            irac: ficha?.irac !== null && ficha?.irac !== undefined ? ficha.irac : '--',
            frac: ficha?.frac !== null && ficha?.frac !== undefined ? ficha.frac : '--',
            concentracion_ia: ficha?.concentracion_ia || '--',
            tiempo_reingreso: ficha?.tiempo_reingreso || '--',
            blanco_biologico: ficha?.blanco_biologico || '',
            dosis: dosisVal, 
            unidad: unidadReal 
        });
    }

    if (container) renderizarChipsProductos(container);
    actualizarMatrizCalculos();
};

window.removerProductoPrograma = function(prod) {
    productosSeleccionadosFumiga = productosSeleccionadosFumiga.filter(p => normalizarTexto(p.nombre) !== normalizarTexto(prod));
    const container = document.getElementById('productos-seleccionados-container');
    if (container) renderizarChipsProductos(container);
    actualizarMatrizCalculos();
};

function renderizarChipsProductos(container) {
    container.innerHTML = productosSeleccionadosFumiga.map(item => {
        const prod = item.nombre;
        const prodEscapado = prod.replace(/'/g, "\\'");
        const unidadVal = obtenerUnidadRealProducto(prod);
        item.unidad = unidadVal;

        return `
            <div class="bg-emerald-900 border border-emerald-500 text-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md">
                <span>${prod} (${unidadVal})</span>
                <button type="button" onclick="removerProductoPrograma('${prodEscapado}')" class="text-emerald-400 hover:text-white font-black ml-1">✕</button>
            </div>
        `;
    }).join('');
}

window.modificarDosisProductoFila = function(nombreProd, nuevaDosis) {
    const productoObj = productosSeleccionadosFumiga.find(p => normalizarTexto(p.nombre) === normalizarTexto(nombreProd));
    if (productoObj) {
        productoObj.dosis = nuevaDosis === "" ? "" : (parseFloat(nuevaDosis) || 0);
        actualizarMatrizCalculos();
    }
};

// ==========================================
// 5. MOTOR DE SUGERENCIA DE ROTACIÓN INFALIBLE
// ==========================================
function conectarSugerenciaPorTipoAplicacion() {
    const selDirigido = document.getElementById('inp-dirigido');
    if (!selDirigido) return;

    selDirigido.onchange = () => {
        evaluarYMostrarSugerencia(selDirigido.value);
        actualizarMatrizCalculos();
    };

    asegurarContenedorSugerenciaHTML();

    if (selDirigido.value) {
        evaluarYMostrarSugerencia(selDirigido.value);
    }
}

function asegurarContenedorSugerenciaHTML() {
    if (document.getElementById('caja-sugerencia-rotacion')) return;

    const selDirigido = document.getElementById('inp-dirigido');
    const anclajePadre = document.getElementById('buscador-alfabetico-grid-wrapper') || 
                         document.getElementById('productos-seleccionados-container')?.parentElement ||
                         selDirigido?.closest('.grid') || 
                         document.getElementById('grid-bloques')?.parentElement;

    if (!anclajePadre) return;

    const banner = document.createElement('div');
    banner.id = 'caja-sugerencia-rotacion';
    banner.className = 'hidden my-3 p-3 bg-emerald-950/95 border border-emerald-500 rounded-xl flex items-center justify-between shadow-xl w-full';
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-2xl">💡</span>
            <div>
                <p class="text-[11px] uppercase text-emerald-400 font-black tracking-wider">Sugerencia de Rotación</p>
                <div id="texto-prod-sugerido" class="text-sm font-bold text-white">--</div>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button type="button" id="btn-aplicar-sugerencia" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-lg transition shadow cursor-pointer">
                + AÑADIR SUGERIDO
            </button>
            <button type="button" onclick="document.getElementById('caja-sugerencia-rotacion').classList.add('hidden')" class="text-slate-400 hover:text-white px-2 py-1 text-xs font-bold cursor-pointer">
                ✕
            </button>
        </div>
    `;

    anclajePadre.parentNode.insertBefore(banner, anclajePadre);

    document.getElementById('btn-aplicar-sugerencia').onclick = () => {
        if (productosRecomendadosLista && productosRecomendadosLista.length > 0) {
            productosRecomendadosLista.forEach(nombreProd => {
                window.seleccionarProductoProgramaAlfabetico(nombreProd);
            });
            document.getElementById('caja-sugerencia-rotacion').classList.add('hidden');
        }
    };
}

async function evaluarYMostrarSugerencia(tipoSeleccionado) {
    asegurarContenedorSugerenciaHTML();
    const banner = document.getElementById('caja-sugerencia-rotacion');
    const texto = document.getElementById('texto-prod-sugerido');
    if (!banner || !texto) return;

    const tipoNorm = normalizarTexto(tipoSeleccionado);
    if (!tipoNorm) {
        banner.classList.add('hidden');
        return;
    }

    let fichesSugeridas = [];
    let ultSemanaTexto = '';

    try {
        const { data: historial, error } = await _supabase
            .from('rotacion_historico')
            .select('semana, producto, tipo_aplicacion, orden_consecutivo')
            .order('orden_consecutivo', { ascending: false })
            .limit(25);

        let historialTipo = [];
        if (!error && historial && historial.length > 0) {
            historialTipo = historial.filter(h => {
                const t = normalizarTexto(h.tipo_aplicacion);
                return t.includes(tipoNorm) || tipoNorm.includes(t);
            });
        }

        const ultimoRegistro = historialTipo.length > 0 ? historialTipo[0] : null;
        let ultimoNombreNorm = '';
        if (ultimoRegistro && ultimoRegistro.producto) {
            const primerProdUltimo = ultimoRegistro.producto.split('/')[0].trim();
            ultimoNombreNorm = normalizarTexto(resolverNombreOficial(primerProdUltimo));
        }

        let cicloClave = Object.keys(CICLOS_ROTACION).find(k => tipoNorm.includes(k) || k.includes(tipoNorm));
        let secuencia = cicloClave ? [...CICLOS_ROTACION[cicloClave]] : ['ZIGNAL', 'SCALA', 'TELDOR COMBI', 'LUNA TRANQUILITY', 'SWITCH'];

        let idxUltimo = -1;
        if (ultimoNombreNorm) {
            idxUltimo = secuencia.findIndex(item => {
                const partes = item.split('/').map(p => normalizarTexto(resolverNombreOficial(p.trim())));
                return partes.some(p => p === ultimoNombreNorm || p.includes(ultimoNombreNorm) || ultimoNombreNorm.includes(p));
            });
        }

        const siguienteIdx = (idxUltimo + 1 + secuencia.length) % secuencia.length;
        const seleccionCiclo = secuencia[siguienteIdx];

        const partesSeleccion = seleccionCiclo.split('/').map(s => s.trim());
        partesSeleccion.forEach(nom => {
            const ficha = obtenerFichaCanonico(nom);
            if (ficha) {
                fichesSugeridas.push(ficha);
            } else {
                fichesSugeridas.push({
                    producto: resolverNombreOficial(nom),
                    registro_ica: '--',
                    ingrediente_activo: '--',
                    categoria_toxicologica: '--',
                    dosis: '',
                    frac: '--',
                    irac: '--',
                    blanco_biologico: ''
                });
            }
        });

        if (ultimoRegistro) {
            ultSemanaTexto = `(Último aplicado sem. ${ultimoRegistro.semana}: <span class="text-slate-300 font-semibold">${ultimoRegistro.producto}</span>)`;
        }

    } catch (err) {
        console.warn("Fallo al evaluar sugerencia:", err);
        const fallback = obtenerFichaCanonico('TELDOR COMBI') || { producto: 'TELDOR COMBI' };
        fichesSugeridas = [fallback];
    }

    if (fichesSugeridas.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    productosRecomendadosLista = fichesSugeridas.map(f => f.producto);

    const etiquetasProductos = fichesSugeridas.map(f => {
        const codAccion = (f.frac && f.frac !== '--') ? `FRAC: ${f.frac}` : ((f.irac && f.irac !== '--') ? `IRAC: ${f.irac}` : null);
        const tagAccion = codAccion ? `<span class="ml-1 text-[10px] bg-emerald-800 text-emerald-100 px-1.5 py-0.5 rounded font-mono">${codAccion}</span>` : '';
        const tagDosis = f.dosis ? `<span class="ml-1 text-[10px] bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded">${f.dosis} cc/L</span>` : '';
        return `<span class="text-emerald-300 font-black">${f.producto}</span>${tagAccion}${tagDosis}`;
    }).join(' <span class="text-slate-400 font-bold mx-1">+</span> ');

    texto.innerHTML = `
        <div class="flex flex-col gap-0.5">
            <div class="flex items-center flex-wrap">Sugerido para <strong>&nbsp;${tipoSeleccionado}:&nbsp;</strong> ${etiquetasProductos}</div>
            ${ultSemanaTexto ? `<div class="text-[10px] text-slate-400 italic mt-0.5">${ultSemanaTexto}</div>` : ''}
        </div>
    `;

    banner.classList.remove('hidden');
}

// ==========================================
// 6. ACTUALIZACIÓN MATRICIAL Y TABLA INFERIOR
// ==========================================
function actualizarMatrizCalculos() {
    asegurarLogoEmpresa();
    
    let contenedorBloquesHorizontal = document.getElementById('tbody-tabla-bloques-horizontal');
    if (!contenedorBloquesHorizontal) {
        const walker = document.createTreeWalker(document.getElementById('reporte-programa') || document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.includes('BLOQUES SELECCIONADOS Y CAMAS:')) {
                let parent = node.parentElement;
                let siguiente = parent.nextElementSibling;
                if (siguiente) {
                    if (siguiente.tagName !== 'TABLE') {
                        siguiente.innerHTML = `<table class="tabla-bloques-ampliada w-full border-collapse border border-slate-400 text-xs"><tbody id="tbody-tabla-bloques-horizontal"></tbody></table>`;
                    }
                    contenedorBloquesHorizontal = siguiente.querySelector('tbody') || document.getElementById('tbody-tabla-bloques-horizontal');
                }
                break;
            }
        }
    }

    if (!contenedorBloquesHorizontal) {
        contenedorBloquesHorizontal = document.querySelector('#reporte-programa table tbody');
    }

    // Asegurar clases diferenciales para el CSS de PDF
    const tablaBloquesNode = contenedorBloquesHorizontal?.closest('table');
    if (tablaBloquesNode) {
        tablaBloquesNode.className = 'tabla-bloques-ampliada w-full border-collapse border border-slate-400 text-xs table-fixed';
    }

    const tablaProductosContenedor = document.querySelector('#reporte-programa table:nth-of-type(2)') || document.querySelector('#tbody-productos-detalle')?.closest('table');
    if (tablaProductosContenedor) {
        tablaProductosContenedor.className = 'tabla-detalle-prods w-full border-collapse border border-slate-300 text-xs text-left';
    }

    const inputTotalCamas = document.getElementById("valor-total-camas");

    let totalCamasGlobal = 0;
    bloquesSeleccionadosFumiga.forEach((camas) => { totalCamasGlobal += camas; });
    if (inputTotalCamas) inputTotalCamas.value = totalCamasGlobal;

    const aguaGlobal = parseFloat(document.getElementById('inp-agua')?.value) || 0;

    if (tablaProductosContenedor) {
        const thead = tablaProductosContenedor.querySelector('thead');
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="p-1 border border-slate-300 text-center">Producto</th>
                    <th class="p-1 border border-slate-300 text-center">Registro ICA</th>
                    <th class="p-1 border border-slate-300 text-center">Ingrediente Activo</th>
                    <th class="p-1 border border-slate-300 text-center">Categoría Toxicológica</th>
                    <th class="p-1 border border-slate-300 text-center">IRAC</th>
                    <th class="p-1 border border-slate-300 text-center">FRAC</th>
                    <th class="p-1 border border-slate-300 text-center">Concentración I.A.</th>
                    <th class="p-1 border border-slate-300 text-center">Tiempo Reingreso</th>
                    <th class="p-1 border border-slate-300 text-center">Dosis</th>
                    <th class="p-1 border border-slate-300 text-center">Cant. Producto</th>
                    <th class="p-1 border border-slate-300 text-center">Blanco Biológico</th>
                </tr>
            `;
        }
    }

    if (contenedorBloquesHorizontal) {
        if (bloquesSeleccionadosFumiga.size === 0) {
            contenedorBloquesHorizontal.innerHTML = `<tr><td class="p-3 text-slate-400 italic text-center text-xs">Selecciona al menos un bloque...</td></tr>`;
        } else {
            let bloquesArray = Array.from(bloquesSeleccionadosFumiga.entries());
            let chunkSize = 16; 
            let htmlTablaBloques = '';

            for (let i = 0; i < bloquesArray.length; i += chunkSize) {
                let grupoBloques = bloquesArray.slice(i, i + chunkSize);

                // FILA 1: Nombres de Bloques en grande
                htmlTablaBloques += `<tr class="bg-slate-200 text-slate-900 uppercase font-black text-xs">`;
                htmlTablaBloques += `<td class="p-2 border border-slate-400 text-center bg-slate-300 font-black w-32 tracking-wider">PRODUCTO</td>`;
                grupoBloques.forEach(([bloque]) => {
                    htmlTablaBloques += `<td class="p-2 border border-slate-400 text-center truncate font-black text-slate-950 text-[11px]">${bloque}</td>`;
                });
                htmlTablaBloques += `</tr>`;

                // FILA 2: Cantidades por Producto
                if (productosSeleccionadosFumiga.length > 0) {
                    productosSeleccionadosFumiga.forEach((prodObj, idx) => {
                        const dosisProd = parseFloat(prodObj.dosis) || 0;
                        const bgRow = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';

                        const unidadReal = obtenerUnidadRealProducto(prodObj.nombre);
                        prodObj.unidad = unidadReal;

                        const etiquetaProd = `${prodObj.nombre} (${unidadReal})`;

                        htmlTablaBloques += `<tr class="${bgRow} text-slate-900 font-bold">`;
                        htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center font-black text-emerald-950 bg-emerald-50 text-[11px]">${etiquetaProd}</td>`;
                        
                        grupoBloques.forEach(([_, camas]) => {
                            const cantidadBloqueCalc = aguaGlobal * dosisProd * camas;
                            const cantidadFormateada = formatearNumero(cantidadBloqueCalc);
                            htmlTablaBloques += `
                                <td class="p-2 border border-slate-300 text-center">
                                    <span class="text-emerald-950 font-black block text-xs">${cantidadFormateada}</span>
                                </td>
                            `;
                        });
                        htmlTablaBloques += `</tr>`;
                    });
                } else {
                    htmlTablaBloques += `<tr class="bg-white text-slate-400 italic">`;
                    htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center font-bold text-slate-700 bg-slate-50">--</td>`;
                    htmlTablaBloques += `<td colspan="${grupoBloques.length}" class="p-2 border border-slate-300 text-center">Añade productos abajo</td>`;
                    htmlTablaBloques += `</tr>`;
                }

                // FILA 3: Litros de Agua por Cama
                htmlTablaBloques += `<tr class="bg-blue-50 font-bold text-blue-950">`;
                htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center font-black bg-blue-100 text-[11px]">LTS (H2O) X CAMA</td>`;
                grupoBloques.forEach(([_, camas]) => {
                    const totalAguaBloque = aguaGlobal * camas;
                    htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center text-blue-950 font-black text-xs">${formatearNumero(totalAguaBloque)}</td>`;
                });
                htmlTablaBloques += `</tr>`;

                // FILA 4: Camas por Bloque
                htmlTablaBloques += `<tr class="bg-slate-100">`;
                htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center font-black text-slate-800 bg-slate-200 text-[11px]">CAMAS</td>`;
                grupoBloques.forEach(([_, camas]) => {
                    htmlTablaBloques += `<td class="p-2 border border-slate-300 text-center font-black text-slate-900 text-xs">${formatearNumero(camas)}</td>`;
                });
                htmlTablaBloques += `</tr>`;
            }

            // TOTAL GENERAL DESTACADO
            htmlTablaBloques += `
                <tr class="bg-slate-800 text-white font-black">
                    <td colspan="${Math.min(bloquesArray.length, chunkSize) + 1}" class="p-2 text-right border border-slate-700 text-xs">
                        TOTAL CAMAS SELECCIONADAS: <span class="text-emerald-300 ml-2 text-sm font-black">${formatearNumero(totalCamasGlobal)}</span>
                    </td>
                </tr>
            `;

            contenedorBloquesHorizontal.innerHTML = htmlTablaBloques;
        }
    }

    const tbodyProductosDetalle = document.getElementById('tbody-productos-detalle');
    if (tbodyProductosDetalle) {
        if (productosSeleccionadosFumiga.length === 0) {
            tbodyProductosDetalle.innerHTML = `<tr><td colspan="11" class="p-2 text-center text-slate-400 italic text-xs">Selecciona al menos un producto...</td></tr>`;
        } else {
            let htmlProductos = '';
            productosSeleccionadosFumiga.forEach(item => {
                const prod = item.nombre;
                const dosisFila = item.dosis;
                
                const ficha = (item.registro_ica && item.registro_ica !== '--') ? item : (encontrarFichaProducto(prod) || {});

                const dosisNumerica = parseFloat(dosisFila) || 0;
                let cantidadTotalProductoCalc = aguaGlobal * dosisNumerica * totalCamasGlobal;
                
                const unidadReal = obtenerUnidadRealProducto(prod);
                const esGramos = unidadReal.toLowerCase().includes('gr') || unidadReal.toLowerCase().includes('g');
                const unidadSufijo = esGramos ? 'grs' : 'cc';

                const prodEscapado = prod.replace(/'/g, "\\'");
                htmlProductos += `
                    <tr class="border-b border-slate-300 bg-white hover:bg-slate-50 transition text-[9.5px]">
                        <td class="p-1 border border-slate-300 font-bold text-slate-900 text-center">${prod}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.registro_ica || '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.ingrediente_activo || '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.categoria_toxicologica || '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.irac !== null && ficha.irac !== undefined ? ficha.irac : '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.frac !== null && ficha.frac !== undefined ? ficha.frac : '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.concentracion_ia || '--'}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.tiempo_reingreso || '--'}</td>
                        <td class="p-1 border border-slate-300 text-center">
                            <input type="number" step="0.01" value="${dosisFila}" onchange="modificarDosisProductoFila('${prodEscapado}', this.value)" class="w-12 bg-slate-50 border border-slate-300 rounded text-center text-emerald-700 font-bold p-0.5 text-[9.5px] outline-none focus:border-emerald-600" placeholder="0.00">
                        </td>
                        <td class="p-1 border border-slate-300 text-emerald-700 font-black text-center">${formatearNumero(cantidadTotalProductoCalc)} ${unidadSufijo}</td>
                        <td class="p-1 border border-slate-300 text-slate-700 text-center">${ficha.blanco_biologico || '--'}</td>
                    </tr>
                `;
            });
            tbodyProductosDetalle.innerHTML = htmlProductos;
        }
    }

    actualizarBloqueObservacionesDirigido(tablaProductosContenedor);
    actualizarPieReporte();
}
window.actualizarMatrizCalculos = actualizarMatrizCalculos;

function actualizarBloqueObservacionesDirigido(tablaProd) {
    if (!tablaProd) return;
    const observacionVal = document.getElementById('inp-observacion')?.value || '';
    const dirigidoVal = document.getElementById('inp-dirigido')?.value || '';

    const bombasChecked = Array.from(document.querySelectorAll('input[name="bomba-usada"]:checked'))
        .map(cb => cb.value);
    const bombasTexto = bombasChecked.length > 0 
        ? bombasChecked.join(', ') 
        : 'Estándar';

    let contenedorObs = document.getElementById('reporte-observaciones-custom');
    if (!contenedorObs) {
        contenedorObs = document.createElement('div');
        contenedorObs.id = 'reporte-observaciones-custom';
        contenedorObs.className = 'mt-1 mb-1 p-1 bg-slate-50 border border-slate-300 rounded text-[9.5px] text-slate-800';
        tablaProd.parentNode.insertBefore(contenedorObs, tablaProd.nextSibling);
    }

    contenedorObs.innerHTML = `
        <div style="display: grid; grid-template-columns: 2.2fr 1fr 1.2fr 1.6fr; gap: 8px; align-items: center;">
            <div>
                <span style="font-weight: 800; text-transform: uppercase;">Obs:</span> 
                <span>${observacionVal || 'Ninguna'}</span>
            </div>
            <div>
                <span style="font-weight: 800; text-transform: uppercase;">Dirigido:</span> 
                <span>${dirigidoVal || '--'}</span>
            </div>
            <div>
                <span style="font-weight: 800; text-transform: uppercase;">Bombas:</span> 
                <span style="font-weight: 700;">${bombasTexto}</span>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; font-size: 8.5pt;">
                <span><strong>pH Ini:</strong> ________</span>
                <span><strong>pH Fin:</strong> ________</span>
            </div>
        </div>
    `;
}

function actualizarPieReporte() {
    const fechaElaboracionVal = document.getElementById('inp-fecha-elaboracion')?.value || '';
    const fechaElabFormateada = fechaElaboracionVal ? fechaElaboracionVal.split('-').reverse().join('/') : '--/--/----';

    const fechaEjecucionVal = document.getElementById('inp-fecha-ejecucion')?.value || '';
    const fechaEjecFormateada = fechaEjecucionVal ? fechaEjecucionVal.split('-').reverse().join('/') : '--/--/----';

    const semanaVal = document.getElementById('inp-semana')?.value || '--';

    const contenedorFirmas = document.querySelector('#lista-fumigadores-nelson')?.parentElement?.nextElementSibling?.parentElement;
    if (contenedorFirmas) {
        contenedorFirmas.className = "mt-2 pt-2 border-t-2 border-slate-400 flex justify-between items-start text-xs";
        
        let htmlFumigadores = '';
        if (datosPersonalCache.length === 0) {
            htmlFumigadores = '<span class="italic text-slate-400">Sin personal registrado</span>';
        } else {
            const mitad = Math.ceil(datosPersonalCache.length / 2);
            const col1 = datosPersonalCache.slice(0, mitad);
            const col2 = datosPersonalCache.slice(mitad);

            htmlFumigadores = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 15px; row-gap: 2px;">
                    <div>
                        ${col1.map(p => `<div style="line-height: 1.15;">• ${p.nombre}</div>`).join('')}
                    </div>
                    <div>
                        ${col2.map(p => `<div style="line-height: 1.15;">• ${p.nombre}</div>`).join('')}
                    </div>
                </div>
            `;
        }

        contenedorFirmas.innerHTML = `
            <!-- Columna Izquierda: Fumigadores en 2 columnas verticales -->
            <div style="width: 52%; font-size: 8.5pt; color: #0f172a;">
                <p style="font-weight: 800; text-transform: uppercase; color: #1e293b; margin-bottom: 2px; font-size: 8.5pt;">Fumigadores Asignados:</p>
                <div style="font-weight: 600;">
                    ${htmlFumigadores}
                </div>
            </div>

            <!-- Columna Derecha: Firmas de Agrónomo y Supervisor -->
            <div style="width: 45%; display: flex; justify-content: flex-end; gap: 20px; text-align: center;">
                <div style="width: 145px;">
                    <div style="border-top: 1.5px solid #334155; padding-top: 2px; margin-top: 11mm;">
                        <p style="font-weight: 800; text-transform: uppercase; color: #0f172a; font-size: 8.5pt; margin: 0;">Rodrigo Muñoz</p>
                        <span style="display: block; font-size: 7pt; font-weight: 700; color: #475569; text-transform: uppercase;">Ingeniero Agrónomo</span>
                        <span style="display: block; font-size: 6.5pt; color: #64748b; text-transform: uppercase;">Control Fitosanitario</span>
                    </div>
                </div>
                <div style="width: 145px;">
                    <div style="border-top: 1.5px solid #334155; padding-top: 2px; margin-top: 11mm;">
                        <p style="font-weight: 800; text-transform: uppercase; color: #0f172a; font-size: 8.5pt; margin: 0;">Nelson Suárez</p>
                        <span style="display: block; font-size: 7pt; font-weight: 700; color: #475569; text-transform: uppercase;">Líder de Fumigación</span>
                        <span style="display: block; font-size: 6.5pt; color: #64748b; text-transform: uppercase;">Supervisor de Campo</span>
                    </div>
                </div>
            </div>
        `;
    }

    let elemFechaSuperior = document.getElementById('header-fecha-elaboracion-bloque');
    if (!elemFechaSuperior) {
        const walker = document.createTreeWalker(document.getElementById('reporte-programa') || document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            let text = node.nodeValue.trim();
            if (text.includes('Fecha Plan') || text.includes('Fecha de Elaboración') || text.includes('Semana:')) {
                elemFechaSuperior = node.parentElement;
                break;
            }
        }
    }

    if (elemFechaSuperior) {
        elemFechaSuperior.id = 'header-fecha-elaboracion-bloque';
        elemFechaSuperior.style.lineHeight = '1.2';
        elemFechaSuperior.style.fontSize = '8.5pt';
        elemFechaSuperior.style.color = '#0f172a';
        elemFechaSuperior.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                <span><strong>Elaboración:</strong> ${fechaElabFormateada}</span>
                <span><strong>Ejecución:</strong> ${fechaEjecFormateada}</span>
                <span><strong>Semana:</strong> <span style="font-size: 9.5pt; font-weight: 900; color: #065f46;">${semanaVal}</span></span>
                <span><strong>Fecha Real:</strong> ____________</span>
            </div>
        `;
    }
}

document.addEventListener('input', (e) => {
    if (['inp-agua', 'inp-fecha-elaboracion', 'inp-fecha-ejecucion', 'inp-observacion', 'inp-semana', 'inp-dirigido'].includes(e.target.id)) {
        actualizarMatrizCalculos();
    }
});

document.addEventListener('change', async (e) => {
    if (e.target.name === 'bomba-usada') {
        actualizarMatrizCalculos();
    }
    if (['inp-semana', 'inp-observacion', 'inp-dirigido'].includes(e.target.id)) {
        if (e.target.id === 'inp-semana') {
            await dispararRecalculoPorSemana(e.target.value);
        }
        actualizarMatrizCalculos();
    }
});

async function registrarAplicacionEnHistorico(numeroOrdenGenerada) {
    const semana = document.getElementById('inp-semana')?.value || '';
    const dirigido = document.getElementById('inp-dirigido')?.value || 'GENERAL';

    if (!semana || productosSeleccionadosFumiga.length === 0) return;

    try {
        const numOrdenFinal = parseInt(numeroOrdenGenerada, 10) || 21000;
        const nombreProductos = productosSeleccionadosFumiga.map(p => p.nombre).join(' / ');

        await Promise.allSettled([
            _supabase.from('rotacion_historico').insert([{
                orden_consecutivo: numOrdenFinal,
                semana: semana,
                tipo_aplicacion: dirigido.toUpperCase(),
                producto: nombreProductos
            }]),
            _supabase.from('historial_fumigaciones').insert([{
                orden: numOrdenFinal,
                semana: semana,
                tipo: dirigido.toUpperCase(),
                productos: nombreProductos,
                fecha_ejecucion: document.getElementById('inp-fecha-ejecucion')?.value || new Date().toISOString().split('T')[0]
            }])
        ]);
    } catch (e) {
        console.warn("Registro complementario en BD omitido:", e);
    }
}

// ==========================================
// 7. SUSCRIPCIONES EN TIEMPO REAL (SUPABASE REALTIME)
// ==========================================
function suscribirCambiosEnTiempoReal() {
    console.log("Conectando canales en tiempo real con Supabase...");

    _supabase
        .channel('cambios-fumigacion-en-vivo')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rotacion_productos' },
            async (payload) => {
                console.log("Cambio detectado en rotacion_productos:", payload.eventType);
                await cargarCatalogoFumigaciones();
                poblarDesplegablesPrograma();
                
                const selDirigido = document.getElementById('inp-dirigido');
                if (selDirigido && selDirigido.value) {
                    await evaluarYMostrarSugerencia(selDirigido.value);
                }
                actualizarMatrizCalculos();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rotacion_historico' },
            async (payload) => {
                console.log("Cambio detectado en rotacion_historico:", payload.eventType);
                const selDirigido = document.getElementById('inp-dirigido');
                if (selDirigido && selDirigido.value) {
                    await evaluarYMostrarSugerencia(selDirigido.value);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'config_bloques' },
            async () => {
                console.log("Cambio detectado en config_bloques");
                await cargarCatalogoBloques();
                renderizarPanelControlBloques();
                actualizarMatrizCalculos();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'obs_fumigacion' },
            async () => {
                console.log("Cambio detectado en obs_fumigacion");
                await cargarObservacionesFumigacion();
                actualizarMatrizCalculos();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'agropather' },
            async () => {
                console.log("Cambio detectado en agropather");
                const selSemana = document.getElementById('inp-semana');
                if (selSemana && selSemana.value) {
                    await dispararRecalculoPorSemana(selSemana.value);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Canal en tiempo real conectado y activo.");
            }
        });
}

// ==========================================
// 8. GESTOR DE HISTORIAL PDF (IndexedDB)
// ==========================================
const DB_NAME = 'AgromonteFumigacionDB';
const STORE_NAME = 'programas_pdf';

function abrirDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'orden' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function guardarPDFEnHistorial(registro) {
    try {
        const db = await abrirDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(registro);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.warn("Error guardando en IndexedDB:", e);
    }
}

async function obtenerTodosProgramasPDF() {
    try {
        const db = await abrirDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        return new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch (e) {
        console.warn("Error leyendo de IndexedDB:", e);
        return [];
    }
}

window.abrirModalHistorialProgramas = async function() {
    const modal = document.getElementById('modal-historial-programas');
    const tbody = document.getElementById('tbody-historial-programas-pdf');
    if (!modal || !tbody) return;

    modal.classList.remove('hidden');
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">Cargando historial...</td></tr>';

    const programas = await obtenerTodosProgramasPDF();
    
    if (programas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Aún no has generado órdenes de fumigación.</td></tr>';
        return;
    }

    programas.sort((a, b) => Number(b.orden) - Number(a.orden));

    tbody.innerHTML = programas.map(p => `
        <tr class="hover:bg-slate-800/60 transition">
            <td class="p-3">
                <button onclick="verPDFHistorial('${p.orden}')" class="text-emerald-400 hover:text-emerald-300 font-mono font-black text-sm underline cursor-pointer">
                    #${p.orden}
                </button>
            </td>
            <td class="p-3 font-bold text-slate-300">${p.semana || '--'}</td>
            <td class="p-3 text-slate-300">${p.fechaEjecucion || '--'}</td>
            <td class="p-3"><span class="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-300">${p.dirigido || '--'}</span></td>
            <td class="p-3 text-slate-300 truncate max-w-xs" title="${p.productos}">${p.productos || '--'}</td>
            <td class="p-3 text-center">
                <button onclick="verPDFHistorial('${p.orden}')" class="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] px-3 py-1 rounded transition shadow cursor-pointer">
                    📄 Ver PDF
                </button>
            </td>
        </tr>
    `).join('');
};

window.cerrarModalHistorialProgramas = function() {
    const modal = document.getElementById('modal-historial-programas');
    if (modal) modal.classList.add('hidden');
};

window.verPDFHistorial = async function(orden) {
    const programas = await obtenerTodosProgramasPDF();
    const encontrado = programas.find(p => String(p.orden) === String(orden));
    
    if (!encontrado || !encontrado.pdfBase64) {
        alert("No se encontró el archivo PDF para esta orden.");
        return;
    }

    const arr = encontrado.pdfBase64.split(',');
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
};

// ==========================================
// 9. GENERACIÓN EXACTA DE PDF (1 HOJA LANDSCAPE)
// ==========================================
window.exportarProgramaPDF = function() {
    if (bloquesSeleccionadosFumiga.size === 0 || productosSeleccionadosFumiga.length === 0) {
        alert("Por favor selecciona al menos un bloque y un producto antes de exportar el PDF.");
        return;
    }

    const lblOrden = document.getElementById('lbl-orden');
    const numeroOrden = lblOrden ? lblOrden.textContent.trim() : '21000';
    const elementoReporte = document.getElementById('reporte-programa');

    if (!elementoReporte) {
        alert("No se encontró el contenedor del reporte.");
        return;
    }

    const semanaVal = document.getElementById('inp-semana')?.value || '';
    const fechaEjecVal = document.getElementById('inp-fecha-ejecucion')?.value || '';
    const selectDirigido = document.getElementById('inp-dirigido');
    const dirigidoTexto = (selectDirigido?.options[selectDirigido.selectedIndex]?.text || selectDirigido?.value || 'GENERAL').trim();
    
    const dirigidoLimpio = dirigidoTexto.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const nombreArchivoPDF = `${numeroOrden} ${dirigidoLimpio}.pdf`;

    const productosVal = productosSeleccionadosFumiga.map(p => p.nombre).join(' / ');

    registrarAplicacionEnHistorico(numeroOrden);

    const estiloOriginal = elementoReporte.style.cssText;
    const claseOriginal = elementoReporte.className;

    const inputs = elementoReporte.querySelectorAll('input, select');
    const reemplazos = [];

    inputs.forEach(input => {
        if (input.classList.contains('hidden') || input.style.display === 'none') return;
        
        const span = document.createElement('span');
        span.style.fontWeight = 'bold';
        span.style.color = '#065f46';
        span.style.textAlign = 'center';
        span.style.display = 'inline-block';
        
        if (input.tagName === 'INPUT') {
            span.innerText = input.value || (input.type === 'number' ? '0' : '');
        } else if (input.tagName === 'SELECT') {
            span.innerText = input.options[input.selectedIndex]?.text || '';
        }

        input.parentNode.insertBefore(span, input);
        input.style.display = 'none'; 
        reemplazos.push({ input, span });
    });

    const loader = document.createElement('div');
    loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(15,23,42,0.92); z-index: 999999; display: flex; justify-content: center; align-items: center; color: white; font-size: 16px; font-weight: bold;';
    loader.innerHTML = `<span>Descargando ${nombreArchivoPDF} y guardando historial...</span>`;
    document.body.appendChild(loader);

    elementoReporte.classList.add('modo-exportacion-pdf');

    setTimeout(() => {
        const opciones = {
            margin:       [3, 3, 3, 3],
            filename:     nombreArchivoPDF,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 1.2, 
                useCORS: true, 
                logging: false,
                scrollY: 0,
                scrollX: 0
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'letter', 
                orientation: 'landscape',
                compress: true
            },
            pagebreak: { mode: [] }
        };

        if (typeof window.html2pdf !== 'undefined') {
            const worker = window.html2pdf().from(elementoReporte).set(opciones);
            
            worker.toPdf().get('pdf').then((pdfObj) => {
                const pdfBase64 = pdfObj.output('datauristring');
                
                guardarPDFEnHistorial({
                    orden: String(numeroOrden),
                    semana: semanaVal,
                    fechaEjecucion: fechaEjecVal,
                    dirigido: dirigidoTexto,
                    productos: productosVal,
                    nombreArchivo: nombreArchivoPDF,
                    pdfBase64: pdfBase64,
                    fechaCreacion: new Date().toISOString()
                });
            }).save().then(() => {
                restaurarDOM();
                
                const numActual = parseInt(numeroOrden, 10);
                if (!isNaN(numActual) && lblOrden) {
                    const siguienteNum = numActual + 1;
                    lblOrden.textContent = siguienteNum;
                    actualizarMatrizCalculos();
                }
            }).catch(err => {
                console.error("Error al generar PDF:", err);
                restaurarDOM();
                window.print();
            });
        } else {
            restaurarDOM();
            window.print();
        }

    }, 200);

    function restaurarDOM() {
        elementoReporte.classList.remove('modo-exportacion-pdf');
        elementoReporte.style.cssText = estiloOriginal;
        elementoReporte.className = claseOriginal;
        reemplazos.forEach(item => {
            item.span.remove();
            item.input.style.display = '';
        });
        loader.remove();
    }
};