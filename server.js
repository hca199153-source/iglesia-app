import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Probar conexión a la Base de Datos
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error de conexión a PostgreSQL:', err.stack);
  } else {
    console.log('Conexión exitosa a la Base de Datos PostgreSQL');
    release();
  }
});

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para procesar datos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// RUTA PRINCIPAL: Muestra el formulario
app.get('/', (req, res) => {
  const mensajeExito = req.query.exito === '1' ? '¡Registro guardado con éxito!' : null;
  const mensajeError = req.query.error ? decodeURIComponent(req.query.error) : null;
  res.render('index', { mensajeExito, mensajeError });
});

// RUTA POST: Procesar y guardar el formulario con redirección (PRG)
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

    // Insertar en la tabla registros
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

    // Insertar en la tabla maestros
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
    
    // Redirección para evitar duplicidad al presionar F5/Recargar
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
