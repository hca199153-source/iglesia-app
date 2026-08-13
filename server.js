const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuración de plantillas EJS y Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. RUTA PRINCIPAL (Formulario)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// 2. GUARDAR REGISTRO
app.post('/guardar', async (req, res) => {
  try {
    const { nombre_iglesia, nombre_pastor, telefono_pastor, nombre_lider, telefono_lider, num_maestros } = req.body;
    
    await pool.query(
      `INSERT INTO registros (nombre_iglesia, nombre_pastor, telefono_pastor, nombre_lider, telefono_lider, num_maestros) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nombre_iglesia, nombre_pastor, telefono_pastor, nombre_lider, telefono_lider, num_maestros]
    );

    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    console.error("Error al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// 3. PANEL DE ADMINISTRACIÓN
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registros ORDER BY id ASC');
    res.render('admin', { registros: result.rows });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

// 4. ELIMINAR REGISTRO (Resuelve el Cannot POST /eliminar/:id)
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM registros WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Error al eliminar registro:", err);
    res.redirect('/admin');
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
});
