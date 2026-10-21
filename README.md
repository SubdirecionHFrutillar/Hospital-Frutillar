# Sitio web Hospital de Frutillar

Sitio estático hecho con [Eleventy](https://www.11ty.dev/) y Tailwind CSS, publicado en Netlify.
Las páginas y noticias se editan desde el panel `/admin` (Decap CMS).

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
nuevas parten con esa clave en vez de una individual. Hay que volver a publicar después de crearla o cambiarla.

- El funcionario debe cambiarla en su primer ingreso y no puede volver a usarla como clave personal.
- **Vence a las 72 horas** de creada la cuenta. Si no ingresó a tiempo, el administrador usa *Restablecer clave*,
  que genera una clave individual (también con 72 horas de vigencia).
- Conviene comunicarla por un canal interno y cambiarla de vez en cuando.

Sin esta variable, cada cuenta nueva recibe una clave temporal individual que se muestra una sola vez.

### Uso diario

- **Crear cuentas:** Portal → *Administrar cuentas*. La cuenta parte con la clave inicial común o con una clave temporal individual (ver arriba); en ambos casos el funcionario debe cambiarla en su primer ingreso.
- **Olvidó su contraseña:** el administrador usa *Restablecer clave* y entrega la nueva temporal.
- **Dejar sin acceso:** *Desactivar* (cierra sus sesiones abiertas).
- **Agregar accesos al portal:** editar `_data/portal.json`.

### Más adelante

Si el hospital adopta una base de datos o un directorio institucional, solo hay que reemplazar
`netlify/lib/usuarios.mjs`; las páginas y la API no cambian.

## Formulario de contacto

Usa **Netlify Forms**. Para recibir los mensajes: Netlify → *Forms* → habilitar la detección de formularios,
y en *Form notifications* agregar el correo de la OIRS.
