const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase- Font-js'); // O tu cliente de BD
const app = express();

// Configuración de Supabase (o tu base de datos)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta Principal (Formulario de Registro)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// Guardar Registro
app.post('/guardar', async (req, res) => {
  try {
    const { data, error } = await supabase.from('registros').insert([req.body]);
    if (error) throw error;
    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// Panel de Administración
app.get('/admin', async (req, res) => {
  try {
    const { data: registros, error } = await supabase.from('registros').select('*').order('id', { ascending: true });
    if (error) throw error;
    res.render('admin', { registros });
  } catch (error) {
    res.render('admin', { registros: [] });
  }
});

// 🟡 NUEVA RUTA: Mostrar Formulario de Edición
app.get('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: registro, error } = await supabase.from('registros').select('*').eq('id', id).single();
    if (error) throw error;
    res.render('editar', { registro });
  } catch (error) {
    res.redirect('/admin');
  }
});

// 🟢 NUEVA RUTA: Procesar Edición
app.post('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('registros').update(req.body).eq('id', id);
    if (error) throw error;
    res.redirect('/admin');
  } catch (error) {
    res.redirect('/admin');
  }
});

// Eliminar Registro
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('registros').delete().eq('id', id);
    res.redirect('/admin');
  } catch (error) {
    res.redirect('/admin');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
