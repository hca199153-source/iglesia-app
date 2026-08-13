require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de conexión PostgreSQL / Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Permite la conexión SSL con Supabase en Render
  }
});

// Middleware para procesar datos del formulario y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de Motor de Plantillas (EJS) y archivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesiones para el panel de administración
app.use(session({
  secret: 'clave_secreta_iglesia_2026',
  resave: false,
  saveUninitialized: false
}));

// Middleware de Autenticación para proteger el Admin
function protegerAdmin(req, res, next) {
  if (req.session && req.session.esAdmin) {
    return next();
  }
  res.redirect('/admin-login');
}

// ------------------- RUTAS PÚBLICAS ------------------- //

// Página principal (Formulario)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// Guardar Registro del Formulario
app.post('/guardar', async (req, res) => {
  const {
    nombre_pastor,
    telefono_pastor,
    correo_pastor,
    nombre_iglesia,
    direccion_iglesia,
    num_maestros,
    nombre_lider,
    telefono_lider,
    correo_lider
  } = req.body;

  try {
    const query = `
      INSERT INTO registros_iglesia 
      (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion_iglesia, num_maestros, nombre_lider, telefono_lider, correo_lider)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    const valores = [
      nombre_pastor,
      telefono_pastor,
      correo_pastor,
      nombre_iglesia,
      direccion_iglesia,
      num_maestros,
      nombre_lider,
      telefono_lider,
      correo_lider
    ];

    await pool.query(query, valores);
    res.render('index', { mensajeExito: '¡Registro completado con éxito!', mensajeError: null });
  } catch (error) {
    console.error('Error al insertar en la base de datos:', error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar la información.' });
  }
});

// ------------------- RUTAS ADMIN ------------------- //

// Login de Admin
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

// Panel de Administración (Protegido)
app.get('/admin', protegerAdmin, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM registros_iglesia');
    res.render('admin', { registros: resultado.rows });
  } catch (error) {
    console.error('Error al obtener registros:', error);
    res.status(500).send(`Error al cargar el panel de administración: ${error.message}`);
  }
});

// Cerrar Sesión
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin-login');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
