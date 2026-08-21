const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Configuración de plantillas y middlewares
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Configuración de Sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_samaritan',
  resave: false,
  saveUninitialized: false
}));

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Middleware Auth Admin
const requiereAuth = (req, res, next) => {
  if (req.session && req.session.esAdmin) {
    return next();
  }
  res.redirect('/admin-login');
};

// Rutas
app.get('/admin-login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.esAdmin = true;
    return res.redirect('/admin');
  }

  res.render('admin-login', { error: 'Contraseña incorrecta' });
});

app.get('/admin', requiereAuth, async (req, res) => {
  try {
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
    console.error("Error al cargar registros en /admin:", error);
    res.render('admin', { registros: [] });
  }
});

app.delete('/eliminar/:id', requiereAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar dependencias
    await supabase.from('maestros').delete().eq('registro_id', id);
    await supabase.from('guerreros_oracion').delete().eq('registro_id', id);
    await supabase.from('guerreritos_oracion').delete().eq('registro_id', id);
    await supabase.from('tutores').delete().eq('registro_id', id);

    // Eliminar registro padre
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error Supabase:", error);
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error servidor:", err);
    return res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
