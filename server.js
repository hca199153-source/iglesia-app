<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Grupos WhatsApp | Samaritan's Purse</title>
    <link rel="icon" type="image/png" href="/images/logo.png">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background-color: #0b221a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2b2b2b; }
        .admin-container { max-width: 1400px; margin: 20px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); padding: 25px; }
    </style>
</head>
<body>
    <div class="container admin-container">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
                <h4 class="fw-bold text-success mb-0"><i class="fab fa-whatsapp text-success me-2"></i> Control de Integración a Grupos de WhatsApp</h4>
                <p class="small text-muted mb-0">Zona Activa: <span class="fw-bold text-uppercase text-danger"><%= zona %></span></p>
            </div>
            <a href="/admin" class="btn btn-outline-secondary btn-sm fw-bold"><i class="fas fa-arrow-left me-1"></i> Regresar al Panel Principal</a>
        </div>

        <div class="table-responsive">
            <table class="table table-striped table-hover align-middle small">
                <thead class="table-success">
                    <tr>
                        <th>#</th>
                        <th>Iglesia / Pastor</th>
                        <th>Estado en Grupos</th>
                        <th>Integrantes Registrados (Comunidad)</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <% if (iglesias && iglesias.length > 0) { %>
                        <% iglesias.forEach((iglesia, idx) => { 
                            let miembros = iglesia.miembros_comunidad || [];
                            let tieneMiembros = miembros.length > 0;
                        %>
                            <tr>
                                <td class="fw-bold"><%= idx + 1 %></td>
                                <td>
                                    <strong><%= iglesia.nombre_iglesia || 'Sin nombre' %></strong><br>
                                    <small class="text-muted">Pastor: <%= iglesia.nombre_pastor %></small>
                                </td>
                                <td>
                                    <% if (tieneMiembros) { %>
                                        <span class="badge bg-success"><i class="fas fa-check me-1"></i> Integrado (<%= miembros.length %>)</span>
                                    <% } else { %>
                                        <span class="badge bg-danger"><i class="fas fa-clock me-1"></i> Pendiente de unirse</span>
                                    <% } %>
                                </td>
                                <td>
                                    <% if (tieneMiembros) { %>
                                        <% miembros.forEach(m => { %>
                                            <div class="mb-1 border-bottom pb-1">
                                                <span class="fw-bold text-success">[<%= m.rol.toUpperCase() %>]</span> <%= m.nombre_completo %> (<%= m.telefono %>)
                                            </div>
                                        <% }) %>
                                    <% } else { %>
                                        <span class="text-muted fst-italic">Ningún integrante de esta iglesia se ha unido al grupo aún.</span>
                                    <% } %>
                                </td>
                                <td class="text-center">
                                    <button class="btn btn-sm btn-outline-success" onclick="alert('Iglesia ID: <%= iglesia.id %>')">
                                        <i class="fas fa-eye"></i> Detalle
                                    </button>
                                </td>
                            </tr>
                        <% }) %>
                    <% } else { %>
                        <tr><td colspan="5" class="text-center text-muted py-4">No hay registros de iglesias en esta zona.</td></tr>
                    <% } %>
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
