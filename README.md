# WhatsApp Bot para PYMES

Un bot de WhatsApp completo para pequeñas y medianas empresas, construido con Node.js, Express, MongoDB y la biblioteca whatsapp-web.js.

## Características

- 🤖 Respuestas automáticas basadas en palabras clave
- 📝 Toma de pedidos y reservas
- 🔔 Notificaciones en tiempo real
- 💾 Almacenamiento en MongoDB
- 📱 Interfaz web de administración (próximamente)

## Requisitos Previos

- Node.js 14.x o superior
- MongoDB 4.4 o superior (local o en la nube)
- Navegador Chromium (Chrome, Edge, etc.)
- Cuenta de WhatsApp

## Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tuusuario/whatsapp-bot-pyme.git
   cd whatsapp-bot-pyme/backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno:
   - Copia el archivo `.env.example` a `.env`
   - Edita el archivo `.env` con tus configuraciones

4. Inicia MongoDB si no está en ejecución

## Configuración

Crea un archivo `.env` en la carpeta `backend` con las siguientes variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/whatsapp_bot_pyme

# Para iniciar mongo con docker
sudo docker start mongodb

# Para entrar al contenedor de docker interfaz de mongo 
docker exec -it mongodb mongosh

# Session Configuration
SESSION_PATH=./session

# Admin Phone Number (con código de país, ej: 541112345678)
ADMIN_PHONE=TU_NUMERO_DE_TELEFONO

# Server Port
PORT=3000

# Entorno (development/production)
NODE_ENV=development
```

## Uso

1. Inicia el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```

2. Escanea el código QR que aparece en la consola con tu teléfono:
   - Abre WhatsApp en tu teléfono
   - Ve a Ajustes > Dispositivos vinculados > Vincular un dispositivo
   - Escanea el código QR que aparece en la consola

3. El bot estará listo para recibir mensajes

## Comandos del Bot

- `hola` - Muestra el mensaje de bienvenida
- `pedido` - Inicia el proceso de pedido
- `reserva` - Inicia el proceso de reserva
- `ayuda` - Muestra los comandos disponibles

## API Endpoints

- `GET /api/health` - Verifica el estado del servidor
- `GET /api/orders` - Obtiene todos los pedidos
- `POST /api/orders` - Crea un nuevo pedido
- `GET /api/orders/:id` - Obtiene un pedido por ID
- `PATCH /api/orders/:id/status` - Actualiza el estado de un pedido
- `DELETE /api/orders/:id` - Elimina un pedido
- `GET /api/orders/stats` - Obtiene estadísticas de pedidos

## Estructura del Proyecto

```
whatsapp-bot-pyme/
├── backend/
│   ├── config/          # Configuraciones
│   ├── controllers/     # Controladores de la API
│   ├── models/          # Modelos de MongoDB
│   ├── routes/          # Rutas de la API
│   ├── services/        # Lógica de negocio
│   ├── .env             # Variables de entorno
│   ├── app.js           # Aplicación principal
│   └── package.json     # Dependencias y scripts
└── README.md            # Este archivo
```

## Despliegue

### Requisitos para Producción

1. Configura un servidor con Node.js y MongoDB
2. Configura un proxy inverso (Nginx, Apache, etc.)
3. Configura HTTPS con un certificado SSL válido

### Pasos para Despliegue

1. Configura las variables de entorno para producción
2. Instala PM2 para gestión de procesos:
   ```bash
   npm install -g pm2
   ```
3. Inicia la aplicación con PM2:
   ```bash
   pm2 start app.js --name whatsapp-bot-pyme
   ```
4. Configura PM2 para que se inicie automáticamente:
   ```bash
   pm2 startup
   pm2 save
   ```

## Solución de Problemas

### El bot no responde
- Verifica que el servidor esté en ejecución
- Asegúrate de haber escaneado el código QR
- Verifica que el número de teléfono del administrador esté configurado correctamente

### Problemas con MongoDB
- Asegúrate de que MongoDB esté en ejecución
- Verifica la cadena de conexión en `.env`
- Comprueba los permisos de la base de datos

### Errores de autenticación
- Elimina la carpeta `session` y vuelve a escanear el código QR
- Verifica que el número de teléfono tenga una sesión de WhatsApp activa

## Próximas Características

- [ ] Panel de administración web
- [ ] Integración con pasarelas de pago
- [ ] Plantillas de mensajes personalizables
- [ ] Análisis y reportes avanzados
- [ ] Integración con sistemas de inventario

## Contribución

1. Haz un fork del proyecto
2. Crea una rama para tu característica (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Haz push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Distribuido bajo la licencia MIT. Ver `LICENSE` para más información.

## Contacto

Tu Nombre - [@tuusuario](https://twitter.com/tuusuario) - email@ejemplo.com

Enlace del Proyecto: [https://github.com/tuusuario/whatsapp-bot-pyme](https://github.com/tuusuario/whatsapp-bot-pyme)

## Agradecimientos

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Biblioteca para interactuar con WhatsApp Web
- [Express](https://expressjs.com/) - Framework web para Node.js
- [MongoDB](https://www.mongodb.com/) - Base de datos NoSQL
- [Mongoose](https://mongoosejs.com/) - ODM para MongoDB y Node.js
