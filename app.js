import { _supabase, datosCargados, CATEGORIAS_PEDIDO, pedidoActual, formatoNum } from './config.js';
import { guardarNuevoProducto } from './crearProducto.js';
import { cambiarPestanaPedido, limpiarYRegresarInicio, descargarHistorialPDF, initPedidoQuimicos } from './pedidoQuimicos.js';

window.guardarNuevoProducto = guardarNuevoProducto;
window.cambiarPestanaPedido = cambiarPestanaPedido;
window.limpiarYRegresarInicio = limpiarYRegresarInicio;
window.descargarHistorialPDF = descargarHistorialPDF;

window.mostrarModulo = async (modulo) => {
    document.getElementById('menu-principal').classList.add('hidden');
    document.getElementById('seccion-fumigacion').classList.add('hidden');
    document.getElementById('seccion-pedido-quimicos').classList.add('hidden');
    
    const seccionCrearProd = document.getElementById('seccion-crear-producto');
    if (seccionCrearProd) seccionCrearProd.classList.add('hidden');

    if (modulo === 'fumigacion') {
        document.getElementById('seccion-fumigacion').classList.remove('hidden');
    } else if (modulo === 'pedido-quimicos') {
        document.getElementById('seccion-pedido-quimicos').classList.remove('hidden');
        await initPedidoQuimicos(); // <-- Carga los datos y renderiza las tablas de pedidos
    } else if (modulo === 'crear-producto') {
        if (seccionCrearProd) seccionCrearProd.classList.remove('hidden');
    } else {
        document.getElementById('menu-principal').classList.remove('hidden');
    }
};

document.addEventListener("DOMContentLoaded", () => {
    console.log("Agromonte - Sistema Modular Iniciado Correctamente.");
});