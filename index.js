const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de plantillas EJS y Middlewares
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. RUTA PRINCIPAL (Formulario para los pastores)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// 2. GUARDAR REGISTRO Y SUS RELACIONES (Maestros, Guerreros, Guerreritos, Tutores)
app.post('/guardar', async (req, res) => {
  try {
    const {
      nombre_pastor,
      telefono_pastor,
      correo_pastor,
      nombre_iglesia,
      direccion,
      num_cajas,
      nombre_lider,
      telefono_lider,
      correo_lider,
      // Listas/Arreglos provenientes del formulario dinamico
      maestros,
      guerreros_oracion,
      guerreritos_oracion,
      tutores
    } = req.body;

    // A) Insertar el registro principal en la tabla 'registros'
    const { data: registroInsertado, error: errorRegistro } = await supabase
      .from('registros')
      .insert([{
        nombre_pastor,
        telefono_pastor,
        correo_pastor,
        nombre_iglesia,
        direccion,
        num_cajas: Number(num_cajas) || 0,
        nombre_lider,
        telefono_lider,
        correo_lider
      }])
      .select('id')
      .single();

    if (errorRegistro) throw errorRegistro;

    const registro_id = registroInsertado.id;

    // B) Insertar Maestros (si existen)
    if (maestros && Array.isArray(maestros) && maestros.length > 0) {
      const maestrosData = maestros
        .filter(m => m.nombre && m.nombre.trim() !== '')
        .map(m => ({
          registro_id,
          nombre: m.nombre,
          telefono: m.telefono || ''
        }));

      if (maestrosData.length > 0) {
        await supabase.from('maestros').insert(maestrosData);
      }
    }

    // C) Insertar Guerreros de Oración (si existen)
    if (guerreros_oracion && Array.isArray(guerreros_oracion) && guerreros_oracion.length > 0) {
      const guerrerosData = guerreros_oracion
        .filter(g => g.nombre && g.nombre.trim() !== '')
        .map(g => ({
          registro_id,
          nombre: g.nombre,
          telefono: g.telefono || ''
        }));

      if (guerrerosData.length > 0) {
        await supabase.from('guerreros_oracion').insert(guerrerosData);
      }
    }

    // D) Insertar Guerreritos de Oración (si existen)
    if (guerreritos_oracion && Array.isArray(guerreritos_oracion) && guerreritos_oracion.length > 0) {
      const guerreritosData = guerreritos_oracion
        .filter(g => g.nombre && g.nombre.trim() !== '')
        .map(g => ({
          registro_id,
          nombre: g.nombre
        }));

      if (guerreritosData.length > 0) {
        await supabase.from('guerreritos_oracion').insert(guerreritosData);
      }
    }

    // E) Insertar Tutores (si existen)
    if (tutores && Array.isArray(tutores) && tutores.length > 0) {
      const tutoresData = tutores
        .filter(t => t.nombre && t.nombre.trim() !== '')
        .map(t => ({
          registro_id,
          nombre: t.nombre,
          telefono: t.telefono || ''
        }));

      if (tutoresData.length > 0) {
        await supabase.from('tutores').insert(tutoresData);
      }
    }

    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });

  } catch (error) {
    console.error("Error completo al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// 3. PANEL DE ADMINISTRACIÓN (Obtener registros con sus relaciones)
app.get('/admin', async (req, res) => {
  try {
    // Consulta relacional completa en Supabase
    const { data: registros, error } = await supabase
      .from('registros')
      .select(`
        *,
        maestros (*),
        guerreros_oracion (*),
        guerreritos_oracion (*),
        tutores (*)
      `)
      .order('id', { ascending: true });

    if (error) throw error;

    res.render('admin', { registros: registros || [] });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

// 4. ELIMINAR REGISTRO (Endpoint para llamadas DELETE desde AJAX o redirección)
app.delete('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Al tener ON DELETE CASCADE configurado en Supabase, eliminar el registro borrará automáticamente maestros, guerreros, etc.
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error("Error al eliminar registro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compatibilidad por si envías formulario HTML vía POST tradicional para eliminar
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('registros').delete().eq('id', id);
    res.redirect('/admin');
  } catch (error) {
    console.error("Error al eliminar por POST:", error);
    res.redirect('/admin');
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
});
