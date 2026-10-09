# Agenda Estética – cómo ponerla en tu iPhone

Todo gratis, sin Mac y sin ordenador (se puede hacer solo con el iPhone).

## 1. Publicar la app (una sola vez, ~10 min)

La app son estos archivos: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.json`, `icon-180.png`, `icon-192.png`, `icon-512.png`.

1. En **Archivos** del iPhone, toca el .zip para descomprimirlo.
2. Entra en **github.com** desde Safari y crea una cuenta gratuita.
3. Toca **+ → New repository**. Nombre: `agenda` (sin espacios). Déjalo en **Public** y pulsa **Create repository**.
4. Pulsa **uploading an existing file**, elige **todos** los archivos descomprimidos (los 8) y pulsa **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`, y pulsa **Save**.
6. Espera 1–2 minutos. Arriba aparecerá la dirección: `https://TU-USUARIO.github.io/agenda/`

> El repositorio es público, pero **tus citas y teléfonos no**: se guardan solo dentro de tu iPhone.

## 2. Instalarla en el iPhone

1. Abre esa dirección **en Safari** (no en Chrome).
2. Toca **Compartir → Añadir a pantalla de inicio → Añadir**.
3. Ábrela siempre desde el icono nuevo. Funciona sin conexión.

## 3. Uso diario

- **＋** crea una cita (nombre, teléfono, fecha, hora, servicio, notas).
- **Pulsar una cita** abre el cobro: Realizada / No vino, importe, propina y forma de pago.
- **WhatsApp** abre el chat con el mensaje del recordatorio ya escrito; solo das a enviar.
- **🔔 Recordatorios de mañana** (arriba en la agenda) lista las citas de mañana con su botón de WhatsApp.
- **🔔 Aviso** crea un evento en el Calendario del iPhone que te suena 24 h antes con el texto «Recordar a María su cita de mañana a las 11:00».
- **Ingresos**: totales por día, semana y mes con cobrado, propinas y media por cita.

## 4. Muy importante: copia de seguridad

Los datos están solo en tu iPhone. En **Ajustes → Exportar copia** guarda el archivo en iCloud Drive cada semana. Si cambias de móvil o borras la app, lo recuperas con **Importar copia**.

## 5. Actualizar la app más adelante

Si cambias algún archivo en GitHub, edita también `sw.js` y sube el número (`agenda-v1` → `agenda-v2`) para que el iPhone cargue la versión nueva.
