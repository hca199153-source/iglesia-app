import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configuración de conexión a PostgreSQL usando Variables de Entorno
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Probar conexión a la base de datos
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error adquiriendo cliente de base de datos:', err.stack);
  }
  console.log('Conexión exitosa a la base de datos PostgreSQL');
  release();
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ----------------------------------------------------
// RUTAS
// ----------------------------------------------------

// 1. RUTA PRINCIPAL (GET)
app.get('/', (req, res) => {
  // Capturar parámetros de la URL para mostrar alertas tras redirección
  const mensajeExito = req.query.exito === '1' ? '¡Registro guardado con éxito!' : null;
  const mensajeError = req.query.error ? decodeURIComponent(req.query.error) : null;
  res.render('index', { mensajeExito, mensajeError });
});

// 2. GUARDAR REGISTRO (POST)
app.post('/guardar', async (req, res) => {
  const client = await pool.connect();
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
      maestro_nombre,
      maestro_telefono,
      maestro_correo
    } = req.body;

    await client.query('BEGIN');

    // Insertar datos del registro principal
    const resRegistro = await client.query(
      `INSERT INTO registros 
       (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, num_cajas, nombre_lider, telefono_lider, correo_lider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        nombre_pastor || null,
        telefono_pastor || null,
        correo_pastor || null,
        nombre_iglesia || null,
        direccion || null,
        parseInt(num_cajas, 10) || 50,
        nombre_lider || null,
        telefono_lider || null,
        correo_lider || null
      ]
    );

    const registroId = resRegistro.rows[0].id;

    // Normalizar arreglos de maestros
    let nombres = Array.isArray(maestro_nombre) ? maestro_nombre : (maestro_nombre ? [maestro_nombre] : []);
    let telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : (maestro_telefono ? [maestro_telefono] : []);
    let correos = Array.isArray(maestro_correo) ? maestro_correo : (maestro_correo ? [maestro_correo] : []);

    // Insertar registros en la tabla maestros
    for (let i = 0; i < nombres.length; i++) {
      if (nombres[i] && nombres[i].trim() !== '') {
        await client.query(
          `INSERT INTO maestros (registro_id, nombre, telefono, correo)
           VALUES ($1, $2, $3, $4)`,
          [
            registroId,
            nombres[i] || null,
            telefonos[i] || null,
            correos[i] || null
          ]
        );
      }
    }

    await client.query('COMMIT');
    // Redirección PRG para evitar duplicados al recargar con F5
    res.redirect('/?exito=1');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error SQL al guardar:", error);
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  } finally {
    client.release();
  }
});

// Iniciar Servidor
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
