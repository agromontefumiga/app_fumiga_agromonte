import { _supabase, mostrarModalExito } from './config.js';

export async function guardarNuevoProducto() {
    const producto = document.getElementById('np-producto').value.trim();
    
    if (!producto) {
        alert("El nombre del producto es obligatorio.");
        return;
    }

    if (!confirm(`¿Deseas guardar el producto ${producto.toUpperCase()} en la base de datos?`)) {
        return; 
    }

    const nuevoProd = {
        producto: producto.toUpperCase(),
        registro_ica: document.getElementById('np-ica').value.trim(),
        ingrediente_activo: document.getElementById('np-ia').value.trim(),
        categoria_toxicologica: document.getElementById('np-tox').value.trim(),
        concentracion_ia: document.getElementById('np-conc').value.trim(),
        tiempo_reingreso: document.getElementById('np-reingreso').value.trim(),
        valor_cc_lts: document.getElementById('np-cclts').value.trim() || null,
        valor_cc_gr: document.getElementById('np-ccgrs').value.trim() || null,
        casa_comercial: document.getElementById('np-casa').value.trim(),
        blanco_biologico: document.getElementById('np-blanco').value.trim(),
        dosis: document.getElementById('np-dosis').value.trim() || null
    };

    try {
        const { error } = await _supabase.from('fumigaciones').insert([nuevoProd]);
        if (error) throw error;

        mostrarModalExito('¡PRODUCTO GUARDADO!', `El producto ${producto.toUpperCase()} ya está disponible en el sistema.`);
        
        document.querySelectorAll('.np-input').forEach(inp => inp.value = '');
        
    } catch (error) {
        console.error("Error guardando producto:", error);
        alert("Ocurrió un error al guardar: " + error.message);
    }
}