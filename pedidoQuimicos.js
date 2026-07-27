import { _supabase, CATEGORIAS_PEDIDO, pedidoActual, historialPedidos, camasOpcionesHTML, formatoNum } from './config.js';

let semanaSeleccionadaGlobal = "";
let datosOriginalesFumigacion = [];

// ==========================================
// 1. INICIALIZACIÓN Y CARGA DE DATOS
// ==========================================
export async function cargarDatosPedido() {
    try {
        const { data, error } = await _supabase.from('fumigaciones').select('*');
        if (error) throw error;
        datosOriginalesFumigacion = data || [];
        
        const selPedido = document.getElementById("sel-semana-pedido");
        if (selPedido) {
            selPedido.innerHTML = '<option value="" selected disabled>Seleccione semana...</option>';
            
            const semanasUnicas = [...new Set(datosOriginalesFumigacion.map(item => item.semana || item.Semana || item.SEMANA))].filter(Boolean).sort();
            
            if (semanasUnicas.length === 0) {
                for (let i = 1; i <= 52; i++) { 
                    let val = "26" + i.toString().padStart(2, '0'); 
                    selPedido.innerHTML += `<option value="${val}">${val}</option>`; 
                }
            } else {
                semanasUnicas.forEach(sem => {
                    selPedido.innerHTML += `<option value="${sem}">${sem}</option>`;
                });
            }

            selPedido.onchange = () => {
                actualizarTodosLosModulos();
            };
        }
    } catch (err) {
        console.error("Error cargando semanas para pedidos:", err);
    }
}

export async function initPedidoQuimicos() {
    await cargarDatosPedido();
    renderizarCategoriasPedido();
    await cargarHistorialSupabase();
}

// ==========================================
// 2. NAVEGACIÓN ENTRE PESTAÑAS DE PEDIDOS
// ==========================================
export function cambiarPestanaPedido(pestana) {
    ['crear', 'almacen', 'historial'].forEach(p => {
        const btn = document.getElementById(`btn-subtab-${p}`);
        const vista = document.getElementById(p === 'crear' ? 'vista-crear-pedido' : (p === 'almacen' ? 'vista-almacen-pedidos' : 'vista-historial-pedidos'));
        
        if(btn && vista) {
            if(p === pestana) {
                btn.className = "px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg transition shadow-lg text-center";
                vista.classList.remove('hidden');
            } else {
                btn.className = "px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 font-bold rounded-lg hover:bg-slate-700 transition text-center";
                vista.classList.add('hidden');
            }
        }
    });

    if(pestana === 'historial') {
        renderizarHistorial();
    } else if(pestana === 'almacen') {
        renderizarAlmacen();
    }
}

// ==========================================
// 3. RENDERIZAR INTERFAZ DE CREAR PEDIDO
// ==========================================
export function renderizarCategoriasPedido() {
    const cont = document.getElementById('contenedor-categorias-pedido');
    if(!cont) return;
    
    cont.innerHTML = CATEGORIAS_PEDIDO.map(cat => {
        if (cat === 'ADICIONAL') {
            return `
            <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 sm:p-5 relative overflow-hidden mt-6">
                <div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                <h3 class="text-amber-500 font-black mb-4 text-lg ml-2 uppercase tracking-wider">${cat}</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div class="md:col-span-8 relative">
                        <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Producto</label>
                        <input type="text" id="prod-${cat}" oninput="buscarProductoPedido(this, '${cat}')" placeholder="Mín. 3 letras..." autocomplete="off" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:border-amber-500 transition">
                        <div id="drop-${cat}" class="hidden absolute z-50 w-full mt-1 bg-slate-700 border border-slate-500 rounded-lg shadow-2xl max-h-40 overflow-y-auto"></div>
                    </div>
                    <div class="md:col-span-4">
                        <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Cantidad</label>
                        <input type="number" id="cant-${cat}" value="0" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:border-amber-500">
                    </div>
                    <div class="md:col-span-12 mt-2">
                        <button onclick="agregarLineaPedido('${cat}')" class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-lg transition w-full shadow-lg">+ Añadir a ${cat}</button>
                    </div>
                </div>

                <div class="overflow-x-auto rounded-lg border border-slate-700">
                    <table class="w-full text-left border-collapse min-w-[400px] text-sm bg-slate-900">
                        <thead>
                            <tr class="text-xs uppercase text-slate-400 border-b border-slate-700 bg-slate-800">
                                <th class="p-3 w-1/2">Producto</th>
                                <th class="p-3 text-center w-1/4">Cantidad</th>
                                <th class="p-3 text-center w-1/4">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="lista-${cat}"></tbody>
                    </table>
                </div>
            </div>
            `;
        } 
        
        return `
        <div class="bg-slate-900/50 border border-slate-700 rounded-xl p-4 sm:p-5 relative overflow-hidden mt-6">
            <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <h3 class="text-emerald-500 font-black mb-4 text-lg ml-2 uppercase tracking-wider">${cat}</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div class="md:col-span-3 relative">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Producto</label>
                    <input type="text" id="prod-${cat}" oninput="buscarProductoPedido(this, '${cat}')" placeholder="Mín. 3 letras..." autocomplete="off" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 transition">
                    <div id="drop-${cat}" class="hidden absolute z-50 w-full mt-1 bg-slate-700 border border-slate-500 rounded-lg shadow-2xl max-h-40 overflow-y-auto"></div>
                </div>
                <div class="md:col-span-3">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Camas</label>
                    <input type="text" id="camas-${cat}" oninput="calcularLinea('${cat}')" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:border-emerald-500 transition">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">lt/cm</label>
                    <input type="number" id="ltcm-${cat}" oninput="calcularLinea('${cat}')" value="0" step="0.01" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Dosis</label>
                    <input type="number" id="dosis-${cat}" oninput="calcularLinea('${cat}')" value="0" step="0.01" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Total</label>
                    <input type="text" id="tot-${cat}" readonly value="0" class="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5 text-emerald-400 font-bold text-center cursor-not-allowed">
                </div>
                <div class="md:col-span-12 mt-2">
                    <button onclick="agregarLineaPedido('${cat}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-lg transition w-full shadow-lg">+ Añadir a ${cat}</button>
                </div>
            </div>

            <div class="overflow-x-auto rounded-lg border border-slate-700">
                <table class="w-full text-left border-collapse min-w-[600px] text-sm bg-slate-900">
                    <thead>
                        <tr class="text-xs uppercase text-slate-400 border-b border-slate-700 bg-slate-800">
                            <th class="p-3 w-1/3">Producto</th>
                            <th class="p-3 w-1/4">Camas</th>
                            <th class="p-3 text-center w-24">lt/cm</th>
                            <th class="p-3 text-center w-24">Dosis</th>
                            <th class="p-3 text-right w-24">Total</th>
                            <th class="p-3 text-center w-20">Acción</th>
                        </tr>
                    </thead>
                    <tbody id="lista-${cat}"></tbody>
                </table>
            </div>
        </div>
        `;
    }).join('');
    
    CATEGORIAS_PEDIDO.forEach(cat => actualizarTablaPedido(cat));
}

// ==========================================
// 4. LÓGICA DE CÁLCULO 
// ==========================================
export async function actualizarTodosLosModulos() {
    const sel = document.getElementById("sel-semana-pedido");
    if (!sel || !sel.value) return;

    const valorSeleccionado = sel.value; 
    semanaSeleccionadaGlobal = valorSeleccionado;

    const anioNum = 2000 + parseInt(valorSeleccionado.substring(0, 2)); 
    const semanaCompletaNum = parseInt(valorSeleccionado);

    const modulos = ['FLOR', 'DESARROLLO', 'HETERO', 'ACAROS', 'AMBIENTAL'];

    const displayTotalFlor = document.getElementById("valor-total-camas");

    try {
        const { data, error } = await _supabase
            .from('monitoreo_plagas')
            .select('id, bloque, total_camas, camas_peq, hetero_prod, hetero_veg, arana_grave3')
            .eq('anio', anioNum)
            .eq('semana', semanaCompletaNum)
            .order('id', { ascending: false });

        if (error) throw error;

        let totales = { FLOR: 0, DESARROLLO: 0, HETERO: 0, ACAROS: 0, AMBIENTAL: 0 }; 
        let registroAuditoria = []; 

        if (data && data.length > 0) {
            const bloquesExcluidos = ['B01', 'B08', 'B90', 'B91', 'B92', 'B7_2', 'B07_2', 'B09B'];
            const bloquesProcesados = new Set(); 

            data.forEach(item => {
                const bloqueCrudo = String(item.bloque || '');
                const bloqueLimpiado = bloqueCrudo.trim().toUpperCase();
                
                if (!bloquesExcluidos.includes(bloqueLimpiado) && !bloquesProcesados.has(bloqueLimpiado)) {
                    
                    const totalCamas = Number(item.total_camas) || 0;
                    const camasPeq = Number(item.camas_peq) || 0;
                    const hProd = Number(item.hetero_prod) || 0;
                    const hVeg = Number(item.hetero_veg) || 0;
                    const arana = Number(item.arana_grave3) || 0;

                    const camasFlorBloque = (totalCamas - camasPeq);
                    
                    registroAuditoria.push({
                        "Bloque": bloqueLimpiado,
                        "Total Camas (BD)": totalCamas,
                        "Suma a FLOR": camasFlorBloque,
                        "Suma a DESARROLLO (Camas Peq)": camasPeq,
                        "Suma a AMBIENTAL (Total Camas)": totalCamas
                    });

                    totales.FLOR += camasFlorBloque;
                    totales.DESARROLLO += camasPeq;
                    totales.HETERO += (hProd + hVeg);
                    totales.ACAROS += arana;
                    totales.AMBIENTAL += totalCamas;

                    bloquesProcesados.add(bloqueLimpiado);
                }
            });

            totales.FLOR = totales.FLOR + (totales.FLOR * 0.1);
            totales.DESARROLLO = totales.DESARROLLO + (totales.DESARROLLO * 0.1);
        }

        if (displayTotalFlor) {
            displayTotalFlor.innerText = "Total Camas: " + Math.round(totales.FLOR).toLocaleString('es-CO');
        }

        modulos.forEach(cat => {
            const inputElement = document.getElementById(`camas-${cat}`);
            if (inputElement) {
                inputElement.value = Math.round(totales[cat]).toLocaleString('de-DE');
                if (typeof calcularLinea === 'function') calcularLinea(cat);
            }
        });

    } catch (e) {
        console.error("Error consultando la base de datos:", e);
        modulos.forEach(cat => {
            const inputElement = document.getElementById(`camas-${cat}`);
            if (inputElement) inputElement.value = "0";
        });
        if (displayTotalFlor) displayTotalFlor.innerText = "0";
    }
}
window.actualizarTodosLosModulos = actualizarTodosLosModulos;

export function calcularLinea(cat) {
    const elementoCamas = document.getElementById(`camas-${cat}`);
    
    let camasValRaw = elementoCamas?.value || '0';
    camasValRaw = camasValRaw.replace(/\./g, '');
    const camasVal = parseFloat(camasValRaw) || 0;
    
    const ltcm = parseFloat(document.getElementById(`ltcm-${cat}`)?.value) || 0;
    const dosis = parseFloat(document.getElementById(`dosis-${cat}`)?.value) || 0;
    
    const total = camasVal * ltcm * dosis;
    const inputTot = document.getElementById(`tot-${cat}`);
    if(inputTot) inputTot.value = formatoNum(total);
}
window.calcularLinea = calcularLinea;

export function buscarProductoPedido(input, cat) {
    const query = input.value.toLowerCase().trim();
    const drop = document.getElementById(`drop-${cat}`);
    if(!drop) return;

    if (query.length < 3) {
        drop.classList.add('hidden');
        return;
    }

    const filtrados = [...new Set(datosOriginalesFumigacion.map(i => i.producto))]
        .filter(p => p && p.toLowerCase().includes(query))
        .slice(0, 5);

    if (filtrados.length === 0) {
        drop.classList.add('hidden');
        return;
    }

    drop.innerHTML = filtrados.map(prod => `
        <div onclick="seleccionarProductoPedido('${cat}', '${prod}')" class="p-2.5 hover:bg-slate-600 cursor-pointer text-white font-bold text-sm border-b border-slate-600 last:border-none">
            ${prod}
        </div>
    `).join('');
    drop.classList.remove('hidden');
}

window.seleccionarProductoPedido = (cat, prod) => {
    const input = document.getElementById(`prod-${cat}`);
    if(input) input.value = prod;
    const drop = document.getElementById(`drop-${cat}`);
    if(drop) drop.classList.add('hidden');
};

export function agregarLineaPedido(cat) {
    if (pedidoActual[cat].length >= 3) {
        alert(`Solo puedes agregar un máximo de 3 productos a la sección ${cat}.`);
        return;
    }

    const prod = document.getElementById(`prod-${cat}`).value.trim();

    if (cat === 'ADICIONAL') {
        const cantVal = parseFloat(document.getElementById(`cant-${cat}`).value) || 0;
        if (!prod || cantVal <= 0) {
            alert("Por favor selecciona un producto e ingresa una cantidad mayor a 0.");
            return;
        }

        pedidoActual[cat].push({ 
            producto: prod, camasTexto: 'N/A', camasVal: 0, ltcm: 0, dosis: 0, 
            total: formatoNum(cantVal), totalNum: cantVal 
        });
        
        document.getElementById(`prod-${cat}`).value = '';
        document.getElementById(`cant-${cat}`).value = '0';
    } else {
        const elementoCamas = document.getElementById(`camas-${cat}`);
        
        let camasValRaw = elementoCamas.value || '0';
        camasValRaw = camasValRaw.replace(/\./g, '');
        const camasVal = parseFloat(camasValRaw) || 0;
        const camasTexto = formatoNum(camasVal);

        const ltcm = parseFloat(document.getElementById(`ltcm-${cat}`).value) || 0;
        const dosis = parseFloat(document.getElementById(`dosis-${cat}`).value) || 0;
        const totalNum = camasVal * ltcm * dosis;

        if (!prod || camasVal === 0 || ltcm === 0 || dosis === 0) {
            alert("Por favor completa todos los campos antes de añadir.");
            return;
        }

        pedidoActual[cat].push({ 
            producto: prod, camasTexto, camasVal, ltcm, dosis, total: formatoNum(totalNum), totalNum: totalNum 
        });
        
        document.getElementById(`prod-${cat}`).value = '';
        document.getElementById(`ltcm-${cat}`).value = '0';
        document.getElementById(`dosis-${cat}`).value = '0';
        document.getElementById(`tot-${cat}`).value = '0'; 
    }
    
    actualizarTablaPedido(cat);
}
window.agregarLineaPedido = agregarLineaPedido;

export function actualizarTablaPedido(cat) {
    const tbody = document.getElementById(`lista-${cat}`);
    if(!tbody) return;
    const items = pedidoActual[cat];
    
    if (items.length === 0) {
        const colspan = cat === 'ADICIONAL' ? 3 : 6;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-slate-500 text-center py-4 italic">Sin productos añadidos en ${cat}</td></tr>`;
        return;
    }

    if (cat === 'ADICIONAL') {
        tbody.innerHTML = items.map((item, idx) => `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="p-3 font-bold text-white">${item.producto}</td>
                <td class="p-3 text-center font-bold text-amber-400 text-lg">${item.total}</td>
                <td class="p-3 text-center">
                    <button onclick="eliminarItemPedido('${cat}', ${idx})" class="bg-red-900/50 hover:bg-red-600 text-red-200 px-3 py-1 rounded transition text-xs border border-red-800">X</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = items.map((item, idx) => `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">
                <td class="p-3 font-bold text-white">${item.producto}</td>
                <td class="p-3 text-slate-300 text-xs">${item.camasTexto}</td>
                <td class="p-3 text-center">${item.ltcm}</td>
                <td class="p-3 text-center">${item.dosis}</td>
                <td class="p-3 text-right font-bold text-emerald-400 text-lg">${item.total}</td>
                <td class="p-3 text-center">
                    <button onclick="eliminarItemPedido('${cat}', ${idx})" class="bg-red-900/50 hover:bg-red-600 text-red-200 px-3 py-1 rounded transition text-xs border border-red-800">X</button>
                </td>
            </tr>
        `).join('');
    }
}

window.eliminarItemPedido = (cat, idx) => {
    pedidoActual[cat].splice(idx, 1);
    actualizarTablaPedido(cat);
};

// ==========================================
// 5. ENVÍO, ALMACÉN E HISTORIAL
// ==========================================
export function limpiarYRegresarInicio() {
    // Volvemos a la pestaña inicial de creación
    cambiarPestanaPedido('crear');
    
    // Hacemos scroll suave hasta la parte superior de la página
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const selPedido = document.getElementById("sel-semana-pedido");
    if (selPedido) selPedido.value = ""; 
    semanaSeleccionadaGlobal = "";

    const displayTotalFlor = document.getElementById("valor-total-camas");
    if (displayTotalFlor) displayTotalFlor.innerText = "";

    CATEGORIAS_PEDIDO.forEach(cat => { 
        pedidoActual[cat] = []; 
        actualizarTablaPedido(cat);
        const prod = document.getElementById(`prod-${cat}`);
        const camas = document.getElementById(`camas-${cat}`);
        const ltcm = document.getElementById(`ltcm-${cat}`);
        const dosis = document.getElementById(`dosis-${cat}`);
        const tot = document.getElementById(`tot-${cat}`);
        const cant = document.getElementById(`cant-${cat}`); 
        
        if(prod) prod.value = '';
        if(camas) camas.value = ''; 
        if(ltcm) ltcm.value = '0';
        if(dosis) dosis.value = '0';
        if(tot) tot.value = '0';
        if(cant) cant.value = '0'; 
    });
}
window.limpiarYRegresarInicio = limpiarYRegresarInicio;
window.buscarProductoPedido = buscarProductoPedido;

async function cargarHistorialSupabase() {
    try {
        const { data, error } = await _supabase.from('pedidos_quimicos').select('*');
        if (error) throw error;
        historialPedidos.length = 0;
        if(data) historialPedidos.push(...data);
    } catch (err) {
        console.error("Error cargando historial de pedidos:", err);
    }
}

export async function procesarCreacionPedido() {
    let tieneProductos = CATEGORIAS_PEDIDO.some(cat => pedidoActual[cat].length > 0);
    if (!tieneProductos) {
        alert("Agrega al menos un producto antes de enviar el pedido.");
        return;
    }

    let consolidadoGeneral = {};
    CATEGORIAS_PEDIDO.forEach(cat => {
        pedidoActual[cat].forEach(item => {
            let nombre = item.producto.toUpperCase();
            if (!consolidadoGeneral[nombre]) {
                consolidadoGeneral[nombre] = { solicitado: 0, confirmado: 0 };
            }
            consolidadoGeneral[nombre].solicitado += (item.totalNum || parseFloat(item.total.replace(/\./g,'').replace(',','.')) || 0);
        });
    });

    const idPedido = "PED-" + Math.floor(1000 + Math.random() * 9000);
    const nuevoRegistro = {
        id: idPedido,
        semana: semanaSeleccionadaGlobal || "GENERAL",
        fecha: new Date().toLocaleString('es-CO'),
        estado: 'Pendiente',
        detalle: pedidoActual,
        consolidado: consolidadoGeneral
    };

    try {
        const { error } = await _supabase.from('pedidos_quimicos').insert([nuevoRegistro]);
        if (error) throw error;
        
        await cargarHistorialSupabase();
        
        const modalConf = document.getElementById('modal-confirmacion');
        if(modalConf) modalConf.classList.add('hidden');
        
        const modalExito = document.getElementById('modal-exito');
        if(modalExito) modalExito.classList.remove('hidden');
        document.getElementById('modal-exito-titulo').innerText = "¡PEDIDO ENVIADO!";
        document.getElementById('modal-exito-desc').innerText = `El ticket ${idPedido} está pendiente en almacén.`;
        
        // ¡Se ejecuta la limpieza automática del formulario tras el éxito!
        limpiarYRegresarInicio();

    } catch (err) {
        console.error("Error al enviar pedido:", err);
        alert("Error al guardar el pedido: " + err.message);
    }
}

// ----------------------------------------------------
// ACTUALIZADO: MANEJO DEL MODAL DE CONFIRMACIÓN 
// ----------------------------------------------------
window.abrirModalConfirmacion = (tipo, extra = null) => {
    const modal = document.getElementById('modal-confirmacion');
    const overlay = document.getElementById('modal-overlay');
    const btnSi = document.getElementById('modal-btn-si');
    if(!modal || !overlay) return;

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');

    if (tipo === 'crear') {
        document.getElementById('modal-conf-titulo').innerText = "¿Enviar Pedido?";
        document.getElementById('modal-conf-desc').innerText = "Se enviará el consolidado actual a la bandeja de Almacén.";
        btnSi.onclick = () => procesarCreacionPedido();
    } else if (tipo === 'almacen') {
        document.getElementById('modal-conf-titulo').innerText = "¿Confirmar Despacho?";
        document.getElementById('modal-conf-desc').innerText = `¿Estás seguro de guardar y enviar el despacho para el ticket ${extra}? Una vez confirmado, pasará al historial.`;
        btnSi.onclick = () => procesarDespachoAlmacen(extra);
    }
};

// ==========================================
// FUNCIONES DE BÚSQUEDA PARA PRODUCTO EXTRA ALMACÉN
// ==========================================
window.buscarProductoExtraAlmacen = (input, idPedido) => {
    const query = input.value.toLowerCase().trim();
    const drop = document.getElementById(`drop-extra-${idPedido}`);
    if(!drop) return;

    if (query.length < 3) {
        drop.classList.add('hidden');
        return;
    }

    const filtrados = [...new Set(datosOriginalesFumigacion.map(i => i.producto))]
        .filter(p => p && p.toLowerCase().includes(query))
        .slice(0, 5);

    if (filtrados.length === 0) {
        drop.classList.add('hidden');
        return;
    }

    drop.innerHTML = filtrados.map(prod => `
        <div onclick="seleccionarProductoExtraAlmacen('${idPedido}', '${prod}')" class="p-2.5 hover:bg-slate-600 cursor-pointer text-white font-bold text-sm border-b border-slate-600 last:border-none">
            ${prod}
        </div>
    `).join('');
    drop.classList.remove('hidden');
};

window.seleccionarProductoExtraAlmacen = (idPedido, prod) => {
    const input = document.getElementById(`extra-prod-${idPedido}`);
    if(input) input.value = prod;
    const drop = document.getElementById(`drop-extra-${idPedido}`);
    if(drop) drop.classList.add('hidden');
};

window.agregarProductoExtraAlmacen = (idPedido) => {
    const ped = historialPedidos.find(p => p.id === idPedido);
    if (!ped) return;

    const inputProd = document.getElementById(`extra-prod-${idPedido}`);
    const inputCant = document.getElementById(`extra-cant-${idPedido}`);
    
    const producto = inputProd.value.trim().toUpperCase();
    const cantidad = parseFloat(inputCant.value) || 0;

    if (!producto || cantidad <= 0) {
        alert("Ingrese un nombre de producto válido y una cantidad mayor a 0.");
        return;
    }

    Object.keys(ped.consolidado).forEach(prod => {
        const inputConf = document.getElementById(`conf-${idPedido}-${prod}`);
        if(inputConf) {
            ped.consolidado[prod].temporal = parseFloat(inputConf.value) || 0;
        }
    });

    if (!ped.consolidado[producto]) {
        ped.consolidado[producto] = { solicitado: 0, confirmado: 0, temporal: cantidad };
    } else {
        ped.consolidado[producto].temporal = (ped.consolidado[producto].temporal || 0) + cantidad;
    }

    renderizarAlmacen();
};

export function renderizarAlmacen() {
    const cont = document.getElementById('lista-pendientes-almacen');
    if(!cont) return;
    const pendientes = historialPedidos.filter(p => p.estado === 'Pendiente');

    if (pendientes.length === 0) {
        cont.innerHTML = `<div class="text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-700 rounded-lg">No hay pedidos pendientes en almacén.</div>`;
        return;
    }

    cont.innerHTML = pendientes.map(ped => {
        let filasHTML = Object.keys(ped.consolidado).sort().map(producto => {
            const sol = Math.round(ped.consolidado[producto].solicitado);
            const valorInput = ped.consolidado[producto].temporal !== undefined ? ped.consolidado[producto].temporal : sol;

            return `
            <tr class="border-b border-slate-700/50 text-sm">
                <td class="p-3 font-bold text-white">${producto}</td>
                <td class="p-3 text-center text-slate-300">${formatoNum(sol)}</td>
                <td class="p-3 text-center">
                    <input type="number" id="conf-${ped.id}-${producto}" value="${valorInput}" class="w-28 bg-slate-900 border border-slate-600 rounded p-1 text-center text-emerald-400 font-bold outline-none">
                </td>
            </tr>`;
        }).join('');

        return `
        <div class="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg mb-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
                <div>
                    <span class="font-black text-emerald-500 text-lg mr-2">${ped.id}</span>
                    <span class="bg-amber-900/50 text-amber-300 text-xs px-2 py-1 rounded border border-amber-800">Pendiente</span>
                </div>
                <span class="text-xs text-slate-400 font-bold">Semana: ${ped.semana} | <span class="font-normal">${ped.fecha}</span></span>
            </div>
            
            <table class="w-full text-left border-collapse bg-slate-800 rounded overflow-hidden mb-4">
                <thead>
                    <tr class="text-[10px] uppercase text-slate-400 bg-slate-900 border-b border-slate-700">
                        <th class="p-3 w-1/2">Producto</th>
                        <th class="p-3 text-center w-1/4">Solicitado</th>
                        <th class="p-3 text-center w-1/4">Confirmar (Real)</th>
                    </tr>
                </thead>
                <tbody>${filasHTML}</tbody>
            </table>

            <!-- PANEL PARA AÑADIR PRODUCTOS EXTRAS EN ALMACÉN CON AUTOCOMPLETE -->
            <div class="bg-slate-800 p-3 rounded-lg mb-4 border border-slate-600 flex flex-wrap gap-3 items-end">
                <div class="flex-1 min-w-[150px] relative">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Agregar Producto Extra</label>
                    <input type="text" id="extra-prod-${ped.id}" oninput="buscarProductoExtraAlmacen(this, '${ped.id}')" autocomplete="off" placeholder="Mín. 3 letras..." class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-amber-500">
                    <div id="drop-extra-${ped.id}" class="hidden absolute z-50 w-full mt-1 bg-slate-700 border border-slate-500 rounded-lg shadow-2xl max-h-40 overflow-y-auto"></div>
                </div>
                <div class="w-24">
                    <label class="block text-[10px] uppercase text-slate-400 mb-1 font-bold">Cant.</label>
                    <input type="number" id="extra-cant-${ped.id}" placeholder="0" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-amber-500 text-center">
                </div>
                <button onclick="agregarProductoExtraAlmacen('${ped.id}')" class="bg-amber-700 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded transition text-sm border border-amber-600 h-[38px]">
                    + Añadir
                </button>
            </div>

            <div class="text-right">
                <button onclick="abrirModalConfirmacion('almacen', '${ped.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded transition shadow text-sm">
                    ✅ Confirmar y Guardar Despacho
                </button>
            </div>
        </div>`;
    }).join('');
}

window.procesarDespachoAlmacen = async (idPedido) => {
    const ped = historialPedidos.find(p => p.id === idPedido);
    if(!ped) return;

    Object.keys(ped.consolidado).forEach(producto => {
        const input = document.getElementById(`conf-${idPedido}-${producto}`);
        if(input) {
            ped.consolidado[producto].confirmado = parseFloat(input.value) || 0;
        }
        delete ped.consolidado[producto].temporal;
    });

    ped.estado = 'Confirmado';

    try {
        const { error } = await _supabase.from('pedidos_quimicos').update({ 
            estado: 'Confirmado', 
            consolidado: ped.consolidado 
        }).eq('id', idPedido);
        
        if (error) throw error;

        // Ocultamos el modal de confirmación antes de mostrar el de éxito
        const modalConf = document.getElementById('modal-confirmacion');
        if(modalConf) modalConf.classList.add('hidden');

        renderizarAlmacen();
        const modalExito = document.getElementById('modal-exito');
        if(modalExito) modalExito.classList.remove('hidden');
        document.getElementById('modal-exito-titulo').innerText = "¡DESPACHO CONFIRMADO!";
        document.getElementById('modal-exito-desc').innerText = `El pedido ${idPedido} ha sido procesado.`;
        
    } catch (err) {
        console.error("Error al actualizar despacho:", err);
        alert("Error al confirmar en base de datos: " + err.message);
    }
};

export function renderizarHistorial() {
    const cont = document.getElementById('lista-historial-pedidos');
    if(!cont) return;
    const confirmados = historialPedidos.filter(p => p.estado === 'Confirmado');

    let htmlControles = `
        <div class="flex flex-wrap gap-4 items-end bg-slate-800 p-4 rounded-lg border border-slate-700 mb-6 shadow-lg">
            <div>
                <label class="block text-[10px] uppercase text-emerald-400 mb-1 font-bold">Desde la fecha</label>
                <input type="date" id="filtro-fecha-desde" onchange="renderizarHistorial()" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500 transition cursor-pointer text-sm">
            </div>
            <div>
                <label class="block text-[10px] uppercase text-emerald-400 mb-1 font-bold">Hasta la fecha</label>
                <input type="date" id="filtro-fecha-hasta" onchange="renderizarHistorial()" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500 transition cursor-pointer text-sm">
            </div>
            <button onclick="descargarHistorialPDF()" class="bg-red-700 hover:bg-red-600 text-white font-bold px-5 py-2 rounded transition shadow flex items-center h-[38px] border border-red-800 text-sm">
                📄 Exportar PDF Corporativo
            </button>
        </div>
    `;

    const fechaDesdeVal = document.getElementById('filtro-fecha-desde') ? document.getElementById('filtro-fecha-desde').value : '';
    const fechaHastaVal = document.getElementById('filtro-fecha-hasta') ? document.getElementById('filtro-fecha-hasta').value : '';

    if (confirmados.length === 0) {
        cont.innerHTML = htmlControles + `<div class="text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-700 rounded-lg">No hay historial de pedidos confirmados.</div>`;
        return;
    }

    let pedidosAMostrar = confirmados;
    if (fechaDesdeVal || fechaHastaVal) {
        pedidosAMostrar = confirmados.filter(ped => {
            const fechaStr = ped.fecha.split(',')[0].trim();
            const partes = fechaStr.split('/');
            const d = partes[0].padStart(2, '0');
            const m = partes[1].padStart(2, '0');
            const y = partes[2];
            const fechaPedidoIso = `${y}-${m}-${d}`;

            if (fechaDesdeVal && fechaPedidoIso < fechaDesdeVal) return false;
            if (fechaHastaVal && fechaPedidoIso > fechaHastaVal) return false;
            return true;
        });
    }

    if (pedidosAMostrar.length === 0) {
        cont.innerHTML = htmlControles + `<div class="text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-700 rounded-lg">No hay pedidos en ese rango de fechas.</div>`;
        return;
    }

    let htmlTarjetas = pedidosAMostrar.map(ped => {
        const filasHTML = Object.keys(ped.consolidado).sort().map(producto => {
            const sol = Math.round(ped.consolidado[producto].solicitado);
            const conf = Math.round(ped.consolidado[producto].confirmado);
            const dif = conf - sol;
            const textoDif = dif === 0 ? 'Exacto' : (dif > 0 ? '+'+formatoNum(dif) : formatoNum(dif));
            const colorDif = dif === 0 ? 'text-slate-400' : (dif > 0 ? 'text-blue-400' : 'text-red-400 font-black');

            return `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition text-sm">
                <td class="p-3 font-bold text-white">${producto}</td>
                <td class="p-3 text-center text-slate-300">${formatoNum(sol)}</td>
                <td class="p-3 text-center font-bold text-emerald-400">${formatoNum(conf)}</td>
                <td class="p-3 text-right font-bold ${colorDif}">${textoDif}</td>
            </tr>
            `;
        }).join('');

        return `
        <div class="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg mb-4 border-l-4 border-l-emerald-500">
            <div class="flex justify-between items-center border-b border-slate-700 pb-2 mb-4">
                <div>
                    <span class="font-black text-emerald-500 text-lg mr-2">${ped.id}</span>
                    <span class="bg-emerald-900/50 text-emerald-300 text-xs px-2 py-1 rounded border border-emerald-800">✅ Confirmado</span>
                </div>
                <span class="text-xs text-slate-400 font-bold">Semana: ${ped.semana} | <span class="font-normal">${ped.fecha}</span></span>
            </div>
            <table class="w-full text-left border-collapse bg-slate-800 rounded overflow-hidden">
                <thead>
                    <tr class="text-[10px] uppercase text-slate-400 bg-slate-900 border-b border-slate-700">
                        <th class="p-3 w-1/3">Producto</th>
                        <th class="p-3 w-1/5 text-center">Solicitado</th>
                        <th class="p-3 w-1/5 text-center">Confirmado (Real)</th>
                        <th class="p-3 w-1/5 text-right">Diferencia</th>
                    </tr>
                </thead>
                <tbody>${filasHTML}</tbody>
            </table>
        </div>
        `;
    }).join('');

    cont.innerHTML = htmlControles + htmlTarjetas;

    if (fechaDesdeVal) document.getElementById('filtro-fecha-desde').value = fechaDesdeVal;
    if (fechaHastaVal) document.getElementById('filtro-fecha-hasta').value = fechaHastaVal;
}

window.renderizarHistorial = renderizarHistorial;

export function descargarHistorialPDF() {
    const fechaDesdeVal = document.getElementById('filtro-fecha-desde') ? document.getElementById('filtro-fecha-desde').value : '';
    const fechaHastaVal = document.getElementById('filtro-fecha-hasta') ? document.getElementById('filtro-fecha-hasta').value : '';
    
    let pedidosAExportar = historialPedidos.filter(p => p.estado === 'Confirmado');
    let textoRango = "HISTORIAL COMPLETO";

    if (fechaDesdeVal || fechaHastaVal) {
        const txtDesde = fechaDesdeVal ? fechaDesdeVal : "El inicio";
        const txtHasta = fechaHastaVal ? fechaHastaVal : "La actualidad";
        textoRango = `PERÍODO: ${txtDesde} AL ${txtHasta}`;

        pedidosAExportar = pedidosAExportar.filter(ped => {
            const fechaStr = ped.fecha.split(',')[0].trim();
            const partes = fechaStr.split('/');
            const d = partes[0].padStart(2, '0');
            const m = partes[1].padStart(2, '0');
            const y = partes[2];
            const fechaPedidoIso = `${y}-${m}-${d}`;

            if (fechaDesdeVal && fechaPedidoIso < fechaDesdeVal) return false;
            if (fechaHastaVal && fechaPedidoIso > fechaHastaVal) return false;
            return true;
        });
    }

    if (pedidosAExportar.length === 0) {
        alert("No hay datos confirmados para exportar en las fechas seleccionadas.");
        return;
    }

    const divPDF = document.createElement('div');
    divPDF.style.cssText = "background: white; color: #1e293b; font-family: 'Helvetica', 'Arial', sans-serif; padding: 20px; font-size: 12px;";
    
    let contenidoHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="display: table-header-group;">
                <tr>
                    <th colspan="4" style="border-bottom: 4px solid #064e3b; padding-bottom: 15px; margin-bottom: 10px; text-align: left; background: white;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="width: 25%;">
                                <img src="logo.png" alt="Agromonte Logo" style="max-width: 130px; max-height: 80px;" onerror="this.style.display='none'">
                            </div>
                            <div style="width: 75%; text-align: right;">
                                <h1 style="color: #064e3b; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">
                                    REPORTE DE PRODUCTOS QUÍMICOS ALMACÉN
                                </h1>
                                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #334155;">Finca Agromonte</p>
                                <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold; color: #059669;">${textoRango}</p>
                                <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Generado: ${new Date().toLocaleString('es-CO')}</p>
                            </div>
                        </div>
                    </th>
                </tr>
                <tr><th colspan="4" style="height: 15px; background: white;"></th></tr>
                <tr style="background: #064e3b; color: white; font-size: 10px; text-transform: uppercase;">
                    <th style="padding: 10px; border-right: 1px solid #0f766e; text-align: left; width: 25%;">Ticket / Fecha</th>
                    <th style="padding: 10px; border-right: 1px solid #0f766e; text-align: left;">Producto</th>
                    <th style="padding: 10px; border-right: 1px solid #0f766e; text-align: center; width: 15%;">Solicitado</th>
                    <th style="padding: 10px; text-align: center; width: 15%;">Confirmado</th>
                </tr>
            </thead>
            <tbody>
    `;

    pedidosAExportar.forEach(ped => {
        const productos = Object.keys(ped.consolidado).sort();
        productos.forEach((producto, indexProd) => {
            const sol = Math.round(ped.consolidado[producto].solicitado);
            const conf = Math.round(ped.consolidado[producto].confirmado);
            
            const esUltimoProd = indexProd === productos.length - 1;
            const estiloBorde = esUltimoProd ? 'border-bottom: 2px solid #94a3b8;' : 'border-bottom: 1px solid #e2e8f0;';
            const celdaTicket = indexProd === 0 
                ? `<strong>${ped.id}</strong><br><span style="font-size: 9px; color: #64748b;">Semana: ${ped.semana} <br> ${ped.fecha}</span>` 
                : `<span style="color: #cbd5e1;">"</span>`;

            contenidoHTML += `
                <tr style="${estiloBorde}">
                    <td style="padding: 10px; color: #1e293b; vertical-align: top;">${celdaTicket}</td>
                    <td style="padding: 10px; font-weight: bold; color: #1e293b; vertical-align: top;">${producto}</td>
                    <td style="padding: 10px; text-align: center; color: #475569; vertical-align: top;">${formatoNum(sol)}</td>
                    <td style="padding: 10px; text-align: center; color: #064e3b; font-weight: 900; font-size: 13px; background-color: #f8fafc; vertical-align: top;">${formatoNum(conf)}</td>
                </tr>
            `;
        });
    });

    contenidoHTML += `</tbody></table>`;
    divPDF.innerHTML = contenidoHTML;

    html2pdf().set({
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `Reporte_Almacen_Agromonte.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' }
    }).from(divPDF).save();
}
window.descargarHistorialPDF = descargarHistorialPDF;