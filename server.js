const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_KEY no están definidas en las variables de entorno de Render.");
}

// Configuración de plantillas EJS y archivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. RUTA PRINCIPAL (Formulario)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// 2. GUARDAR REGISTRO DEL FORMULARIO
app.post('/guardar', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error("Cliente de Supabase no inicializado. Revisa las variables de entorno en Render.");
    }
    const { error } = await supabase.from('registros').insert([req.body]);
    if (error) throw error;
    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    console.error("Error al guardar:", error.message || error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// 3. PANEL DE ADMINISTRACIÓN
app.get('/admin', async (req, res) => {
  try {
    if (!supabase) {
      return res.render('admin', { registros: [] });
    }
    const { data: registros, error } = await supabase
      .from('registros')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.render('admin', { registros: registros || [] });
  } catch (error) {
    console.error("Error al cargar admin:", error.message || error);
    res.render('admin', { registros: [] });
  }
});

// 4. ELIMINAR REGISTRO
app.post('/eliminar/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.redirect('/admin');
    }
    const { id } = req.params;
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) console.error("Error Supabase al eliminar:", error);
    res.redirect('/admin');
  } catch (err) {
    console.error("Error servidor al eliminar:", err.message || err);
    res.redirect('/admin');
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo correctamente en el puerto ${PORT}`);
});
