// ==========================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================

// ⚠️ REEMPLAZA ESTOS DATOS CON TUS CREDENCIALES REALES DE SUPABASE SI ES NECESARIO
const SUPABASE_URL = 'https://rbybgloxfdwgjabpkwde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJieWJnbG94ZmR3Z2phYnBrd2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTkxODIsImV4cCI6MjA3OTM5NTE4Mn0.UXauoMD_1Z3f-yD5KMViColdLv62NcJ8VzslRaMTqm4';

export const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exponer en window para evitar errores de consola y pruebas directas
window._supabase = _supabase;

export const CATEGORIAS_PEDIDO = ['FLOR', 'DESARROLLO', 'HETERO', 'ACAROS', 'AMBIENTAL', 'ADICIONAL'];
export let pedidoActual = { FLOR: [], DESARROLLO: [], HETERO: [], ACAROS: [], AMBIENTAL: [], ADICIONAL: [] };
export let historialPedidos = [];
export let datosCargados = false;
export let camasOpcionesHTML = '<option value="0">Seleccione...</option>';

// Función de formato numérico con separador de miles (ej: 3.760)
export function formatoNum(num) {
    if (isNaN(num)) return "0";
    return Number(num).toLocaleString('de-DE');
}

// Modales globales
export function mostrarModalExito(titulo, descripcion) {
    const modalConf = document.getElementById('modal-confirmacion');
    const modalExito = document.getElementById('modal-exito');
    if(modalConf) modalConf.classList.add('hidden');
    if(modalExito) modalExito.classList.remove('hidden');
    document.getElementById('modal-exito-titulo').innerText = titulo;
    document.getElementById('modal-exito-desc').innerText = descripcion;
}

export function cerrarModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-confirmacion').classList.add('hidden');
    
    const modalExito = document.getElementById('modal-exito');
    if (modalExito && !modalExito.classList.contains('hidden')) {
        if (typeof window.limpiarYRegresarInicio === 'function') {
            window.limpiarYRegresarInicio();
        }
    }
    if (modalExito) modalExito.classList.add('hidden');
}
window.cerrarModal = cerrarModal;