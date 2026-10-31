# Sitio web Hospital de Frutillar

Sitio estático hecho con [Eleventy](https://www.11ty.dev/) y Tailwind CSS, publicado en Netlify.
Las noticias, avisos e intranet se publican desde el **Portal Funcionarios** y se ven al instante, sin regenerar el sitio.
Las páginas fijas (horarios, servicios, autoridades) se editan desde el panel `/admin` (Decap CMS).

## Desarrollo local

```bash
npm install
npm run dev     # sitio en http://localhost:8080 (recompila HTML y CSS al guardar)
npm run build   # genera _site/
npm test        # pruebas del acceso de funcionarios
```

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `_includes/base.njk` | Plantilla única: encabezado, menú, links de interés, pie |
| `_includes/componentes.njk` | Piezas reutilizables (banner, tarjetas, menús laterales) |
| `_includes/pagina-info.njk` | Plantilla común de Aranceles, Copago Cero y Ley Ricarte Soto |
| `_data/site.json` | Datos del hospital (dirección, teléfonos, enlaces) |
| `_data/nav.json` | Menú principal (escritorio y móvil salen de aquí) |
| `_data/links.json` | Links de interés |
| `_data/portal.json` | Accesos que aparecen en el Portal Funcionarios |
| `_data/*.json` (resto) | Contenido editable desde el CMS |
| `content/noticias/` | Noticias (Markdown) |
| `assets/css/site.css` | Estilos propios; Tailwind se compila en el build |
| `funcionarios/` | Páginas del Portal Funcionarios |
| `netlify/functions/` | API de ingreso y administración de cuentas |
| `netlify/edge-functions/` | Protección de las páginas `/funcionarios/*` |

## Portal Funcionarios (RUT / contraseña)

Las cuentas se guardan en **Netlify Blobs** (almacenamiento incluido en Netlify), sin base de datos externa.
Las contraseñas se guardan cifradas con *scrypt*; la sesión es una cookie firmada (`HttpOnly`, `Secure`,
`SameSite=Strict`) que dura 8 horas. Tras 5 intentos fallidos el RUT queda bloqueado 15 minutos.

### Puesta en marcha (una sola vez)

1. En Netlify → *Site configuration → Environment variables*, crear:
   - `SESSION_SECRET`: texto aleatorio de 32 caracteres o más (por ejemplo, el resultado de `openssl rand -base64 48`). Si se cambia, se cierran todas las sesiones.
   - `FUNCIONARIOS_SETUP_KEY`: una clave temporal para crear el primer administrador.
2. Volver a publicar el sitio.
3. Abrir `/funcionarios/configuracion-inicial.html`, ingresar la clave de configuración y los datos del administrador.
4. Borrar la variable `FUNCIONARIOS_SETUP_KEY` (la página deja de funcionar apenas existe un administrador, pero así queda cerrada del todo).

### Clave inicial común (opcional)

Si se define la variable `FUNCIONARIOS_CLAVE_INICIAL` (secreta, alcance *Functions*), todas las cuentas
nuevas (y las restablecidas) parten con esa clave en vez de una individual. Hay que volver a publicar después de crearla o cambiarla.

- El funcionario debe cambiarla en su primer ingreso y no puede volver a usarla como clave personal.
- **Vence a las 72 horas** de creada o restablecida la cuenta. Si no ingresó a tiempo, el administrador usa
  *Restablecer clave*, que vuelve a la clave común con 72 horas nuevas.
- Conviene comunicarla por un canal interno y cambiarla de vez en cuando.

Sin esta variable, cada cuenta nueva recibe una clave temporal individual que se muestra una sola vez.

### Uso diario

- **Crear cuentas:** Portal → *Administrar cuentas*. La cuenta parte con la clave inicial común o con una clave temporal individual (ver arriba); en ambos casos el funcionario debe cambiarla en su primer ingreso.
- **Olvidó su contraseña:** el administrador usa *Restablecer clave* y entrega la nueva temporal.
- **Dejar sin acceso:** *Desactivar* (cierra sus sesiones abiertas).
- **Agregar accesos al portal:** editar `_data/portal.json`.

### Intranet

La portada del portal (`/funcionarios/`) es el muro de publicaciones de la intranet:

- **Leer:** cualquier cuenta activa. Se filtra por categoría y cada publicación muestra sus adjuntos.
- **Publicar:** cuentas con rol **Editor** o **Administrador** (botón *Publicar*). Se pueden adjuntar PDF, imágenes y archivos de Office de hasta 30 MB cada uno.
- **Editar o eliminar:** el autor de la publicación o un administrador.
- Los textos y archivos se guardan en Netlify Blobs (almacén `intranet`), no en GitHub, y solo se entregan a quien tiene sesión.
- Las categorías están en `netlify/lib/intranet.mjs` y los accesos de la barra lateral en `_data/portal.json`.

### Noticias del sitio público

Las noticias del sitio se publican desde el portal (ya no desde el CMS `/admin`):

- **Quién:** cuentas con rol **Comunicaciones** o **Administrador**. En *Publicar* eligen "Sitio web público"; en *Noticias del sitio* las editan o eliminan.
- **Cómo aparecen:** se guardan en Netlify Blobs (almacén `noticias`) y se ven **al instante**, sin regenerar el sitio
  (cada regeneración cuesta 15 créditos de Netlify). La primera imagen adjunta es la foto principal.
  - La página de cada noticia (`/noticias/<dirección>/`) la arma la función `noticia-pagina` con la plantilla
    `noticias/plantilla.html` (encabezado, menú y pie del sitio), con título e imagen para compartir en WhatsApp/Facebook.
  - Portada y *Noticias* traen una copia del último build y `assets/js/sitio-vivo.js` la reemplaza con lo vigente de `/api/sitio-vivo`.
  - Todo queda en la caché del CDN de Netlify (etiqueta `sitio-vivo`) y se purga al publicar, editar o eliminar.
    Si la purga fallara, lo nuevo se ve igual a los 5 minutos.
- **Build hook:** ya no se usa. Si existe la variable `NETLIFY_BUILD_HOOK` o un *build hook* en Netlify, bórrelos.
- Las noticias antiguas en `content/noticias/*.md` siguen funcionando; si existe una noticia del portal con la misma dirección, se muestra la del portal.

### Avisos del sitio público

Comunicaciones o un administrador publica avisos breves desde **Portal → Avisos** (cambios de horario,
cortes de servicio, feriados). Aparecen en una franja bajo el menú de todas las páginas públicas;
máximo 5 a la vez. Con fecha de término, el aviso se oculta solo ese día. Igual que las noticias,
se ven al instante (vía `/api/sitio-vivo`), sin regenerar el sitio.

### Roles

| Rol | Intranet | Sitio público | Cuentas |
|---|---|---|---|
| Funcionario | Lee | — | — |
| Editor | Lee y publica | — | — |
| Comunicaciones | Lee y publica | Publica noticias | — |
| Administrador | Todo | Todo | Administra |

### Más adelante

Si el hospital adopta una base de datos o un directorio institucional, solo hay que reemplazar
`netlify/lib/usuarios.mjs`; las páginas y la API no cambian.

## Formularios (consultas y actualización de datos)

Usan **Netlify Forms** (gratis e ilimitado en los planes por créditos):

| Formulario | Dónde | Nombre en Netlify |
|---|---|---|
| Consultas | `/contacto.html` | `contacto` |
| Actualiza tus datos | `/actualiza-tus-datos.html` y desplegable en `/contacto.html` | `actualizacion-datos` |

El formulario de datos está en `_includes/form-actualiza-datos.njk` y ambos los maneja `assets/js/formularios.mjs`
(validación, RUT, secciones condicionales). Cada envío trae un asunto propio (campo oculto `subject`).

**Requisito:** Netlify → *Forms* → **Enable form detection** y volver a publicar. Sin esto Netlify rechaza los envíos
(el formulario muestra "No pudimos enviar su consulta").

### Correo con diseño y ficha en PDF

Cada envío verificado (no spam) ejecuta la función `submission-created`, que manda un correo con el diseño del hospital
y adjunta la ficha en PDF (`netlify/lib/fichas.mjs`): folio (`CON-2026-00012`, `ACT-2026-00003`), resumen, mensaje,
datos por sección, plazo legal si es un reclamo y un recuadro de **uso interno** (OIRS / SOME) para completar a mano.
"Responder" en el correo le contesta directo a quien escribió.

Quien completó el formulario recibe además una **confirmación** con su folio, copia de lo que envió y un comprobante
en PDF (sin el recuadro de uso interno), si dejó un correo válido. Si responde a esa confirmación, la respuesta llega
al hospital. Si falla solo la confirmación (p. ej. un correo mal escrito), el correo interno igual se envía.

Configuración (Netlify → *Project configuration → Environment variables*, alcance *Functions*):

| Variable | Valor |
|---|---|
| `SMTP_HOST` | Servidor de salida. Con una cuenta Gmail del hospital: `smtp.gmail.com` |
| `SMTP_PORT` | `465` (por defecto) |
| `SMTP_USER` | La cuenta que envía (p. ej. `xxxx@gmail.com`) |
| `SMTP_PASS` | Con Gmail: una **contraseña de aplicación** (Cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones), no la clave normal |
| `CORREO_FORMULARIOS` | Destinatarios, separados por coma. Por defecto `pablomerino@ssdr.gob.cl` |
| `CORREO_CONTACTO` / `CORREO_ACTUALIZACION` | Opcional: destinatarios propios de cada formulario (p. ej. OIRS y SOME) |
| `CORREO_REMITENTE` | Opcional: `"Hospital de Frutillar" <cuenta@gmail.com>` |
| `COPIA_AL_REMITENTE` | `no` para desactivar la confirmación a quien envió el formulario (por defecto se envía) |
| `CORREO_RESPONDER_A` | Opcional: a dónde llegan las respuestas a esa confirmación (por defecto, los mismos destinatarios) |
| `COPIA_NO_RESPONDER` | `si`: la confirmación sale como correo automático que no recibe respuestas (usar como `SMTP_USER` un buzón "no responder") |
| `CORREO_PARA_SEGUIMIENTO` | Con lo anterior: correo que se indica para agregar información (p. ej. el de la OIRS) |

Después de crear o cambiar las variables hay que volver a publicar. Si el correo falla, el envío igual queda en
Netlify → *Forms* y el error aparece en *Logs → Functions → submission-created*.
No es necesario activar además la notificación por correo de Netlify (llegaría duplicado y sin formato).

Los envíos también quedan en Netlify → *Forms*. Contienen datos personales: limitar quién tiene acceso al equipo de Netlify.
