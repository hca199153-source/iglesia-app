require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Requerido para bases de datos en la nube
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// 1. RUTA PÚBLICA (Formulario + Carrusel)
app.get('/', (req, res) => {
  res.render('index');
});

// Guardar datos del formulario
app.post('/guardar', async (req, res) => {
  const {
    nombre_pastor, telefono_pastor, correo_pastor,
    nombre_iglesia, direccion_iglesia, num_maestros,
    nombre_lider, telefono_lider, correo_lider
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO registros_iglesia 
      (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion_iglesia, num_maestros, nombre_lider, telefono_lider, correo_lider)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion_iglesia, num_maestros, nombre_lider, telefono_lider, correo_lider]
    );
    res.send('<h1>¡Registro completado con éxito! Gracias.</h1><a href="/">Volver</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al guardar la información.');
  }
});

// 2. RUTA PRIVADA / ADMIN (Protegida)
app.get('/admin-login', (req, res) => {
  res.render('login');
});

app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  // Clave simple hardcoded para empezar (luego se puede mejorar con sesiones)
  if (password === process.env.ADMIN_PASSWORD) {
    res.redirect('/admin-dashboard?key=' + process.env.ADMIN_PASSWORD);
  } else {
    res.send('Contraseña incorrecta. <a href="/admin-login">Intentar de nuevo</a>');
  }
});

app.get('/admin-dashboard', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_PASSWORD) {
    return res.status(403).send('Acceso no autorizado');
  }

  try {
    const resultado = await pool.query('SELECT * FROM registros_iglesia ORDER BY creado_en DESC');
    res.render('admin', { registros: resultado.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener registros.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo en puerto ${PORT}`));