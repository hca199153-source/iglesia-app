require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Conexión a Base de Datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- SEGURIDAD ---
// 1. Helmet para proteger cabeceras HTTP (ajustado para permitir estilos y scripts de Bootstrap)
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// 2. Rate Limiting: Limitar intentos en el formulario (Máximo 10 peticiones cada 15 min por IP)
const limonadorFormulario = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
});

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'clave_super_secreta_iglesia_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2 // 2 horas de sesión activa
  }
}));

// Middleware para proteger el Panel
function protegerAdmin(req, res, next) {
  if (req.session && req.session.esAdmin) {
    return next();
  }
  res.redirect('/admin-login');
}

// ------------------- RUTAS PÚBLICAS ------------------- //

app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

app.post('/guardar', limonadorFormulario, async (req, res) => {
  const {
    nombre_pastor, telefono_pastor, correo_pastor,
    nombre_iglesia, direccion_iglesia, num_maestros,
    nombre_lider, telefono_lider, correo_lider
  } = req.body;

  try {
    const query = `
      INSERT INTO registros_iglesia 
      (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion_iglesia, num_maestros, nombre_lider, telefono_lider, correo_lider)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    const valores = [
      nombre_pastor.trim(),
      telefono_pastor.trim(),
      correo_pastor ? correo_pastor.trim() : null,
      nombre_iglesia.trim(),
      direccion_iglesia ? direccion_iglesia.trim() : null,
      parseInt(num_maestros) || 0,
      nombre_lider.trim(),
      telefono_lider.trim(),
      correo_lider ? correo_lider.trim() : null
    ];

    await pool.query(query, valores);
    res.render('index', { mensajeExito: '¡Registro completado con éxito!', mensajeError: null });
  } catch (error) {
    console.error('Error al insertar:', error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar la información.' });
  }
});

// ------------------- RUTAS ADMIN ------------------- //

app.get('/admin-login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.esAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Contraseña incorrecta' });
  }
});

// Dashboard & Lista de Registros
app.get('/admin', protegerAdmin, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM registros_iglesia ORDER BY id DESC');
    
    // Cálculo de Métricas para el Dashboard
    const registros = resultado.rows;
    const totalIglesias = registros.length;
    const totalMaestros = registros.reduce((acc, item) => acc + (parseInt(item.num_maestros) || 0), 0);

    res.render('admin', { registros, totalIglesias, totalMaestros });
  } catch (error) {
    console.error('Error al cargar admin:', error);
    res.status(500).send(`Error al cargar el panel de administración: ${error.message}`);
  }
});

// Editar Registro (Procesar cambio)
app.post('/admin/editar/:id', protegerAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    nombre_pastor, telefono_pastor, correo_pastor,
    nombre_iglesia, direccion_iglesia, num_maestros,
    nombre_lider, telefono_lider, correo_lider
  } = req.body;

  try {
    const query = `
      UPDATE registros_iglesia 
      SET nombre_pastor=$1, telefono_pastor=$2, correo_pastor=$3,
          nombre_iglesia=$4, direccion_iglesia=$5, num_maestros=$6,
          nombre_lider=$7, telefono_lider=$8, correo_lider=$9
      WHERE id=$10
    `;
    await pool.query(query, [
      nombre_pastor, telefono_pastor, correo_pastor,
      nombre_iglesia, direccion_iglesia, parseInt(num_maestros) || 0,
      nombre_lider, telefono_lider, correo_lider, id
    ]);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error al editar:', error);
    res.status(500).send('Error al actualizar el registro');
  }
});

// Eliminar Registro
app.post('/admin/eliminar/:id', protegerAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM registros_iglesia WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error al eliminar:', error);
    res.status(500).send('Error al eliminar el registro');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin-login');
});

app.listen(PORT, () => {
  console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
});
