const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de plantillas EJS y Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. RUTA PRINCIPAL (Formulario para los pastores)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// 2. GUARDAR REGISTRO DEL FORMULARIO
app.post('/guardar', async (req, res) => {
  try {
    const { error } = await supabase.from('registros').insert([req.body]);
    if (error) throw error;
    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    console.error("Error al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// 3. PANEL DE ADMINISTRACIÓN (Ver lista de iglesias)
app.get('/admin', async (req, res) => {
  try {
    const { data: registros, error } = await supabase
      .from('registros')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.render('admin', { registros });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

// 4. ELIMINAR REGISTRO
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) console.error("Error al eliminar:", error);
    res.redirect('/admin');
  } catch (error) {
    console.error("Error en servidor al eliminar:", error);
    res.redirect('/admin');
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
});
