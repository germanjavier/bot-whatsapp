const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Order = require('../models/Order');
const { sendNotification, sendOrderUpdate } = require('./notificationService');

// Business configuration
const BUSINESS_CONFIG = {
  name: 'Mi Negocio',
  phone: process.env.BUSINESS_PHONE || '+5491112345678',
  address: 'Av. Principal 1234, Ciudad',
  hours: 'Lunes a Viernes: 9:00 - 20:00\nSábados: 10:00 - 18:00\nDomingos: Cerrado',
  adminPhone: process.env.ADMIN_PHONE || ''
};

// Menu items
const MENU_ITEMS = [
  { id: 1, name: 'Pizza Margherita', price: 1500, description: 'Salsa de tomate, mozzarella y albahaca' },
  { id: 2, name: 'Hamburguesa Clásica', price: 1200, description: 'Carne, lechuga, tomate y salsas' },
  { id: 3, name: 'Ensalada César', price: 900, description: 'Lechuga, pollo, crutones y aderezo césar' },
  { id: 4, name: 'Agua Mineral', price: 300, description: 'Botella 500ml' },
  { id: 5, name: 'Gaseosa', price: 400, description: 'Lata 350ml' }
];

// User sessions
const userSessions = new Map();

class WhatsAppBot {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'whatsapp-bot-pyme',
        dataPath: process.env.SESSION_PATH || './session',
        clientName: 'WhatsApp Bot PYMES'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.initializeBot();
  }

  initializeBot() {
    // Generate QR Code
    this.client.on('qr', (qr) => {
      console.log('Escanea el código QR con tu teléfono para iniciar sesión:');
      qrcode.generate(qr, { small: true });
    });

    // When authenticated
    this.client.on('authenticated', (session) => {
      console.log('✅ Cliente autenticado correctamente');
    });

    // When ready
    this.client.on('ready', () => {
      console.log('🤖 Bot listo y funcionando');
      console.log(`📱 Conectado como: ${this.client.info.pushname}`);
      console.log(`👤 Número: ${this.client.info.wid.user}`);
    });

    // Message handler
    this.client.on('message', async (msg) => {
      try {
        // Skip if message is from status broadcast
        if (msg.from === 'status@broadcast') return;
        
        console.log(`\n📩 Nuevo mensaje de ${msg.from}: ${msg.body}`);
        
        // Show typing indicator
        await this.client.sendStateTyping(msg.from, true);
        
        // Process message
        await this.handleIncomingMessage(msg);
        
        // Hide typing indicator
        await this.client.sendStateTyping(msg.from, false);
      } catch (error) {
        console.error('❌ Error al procesar mensaje:', error);
        try {
          await msg.reply('❌ Ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo más tarde.');
        } catch (e) {
          console.error('Error al enviar mensaje de error:', e);
        }
      }
    });

    // Handle message acknowledgments
    this.client.on('message_ack', (msg, ack) => {
      console.log(`✅ Mensaje ${msg.id.id} fue ${ack === 3 ? 'entregado' : 'visto'}`);
    });

    // Handle authentication failure
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Error de autenticación:', msg);
    });

    // Handle disconnection
    this.client.on('disconnected', (reason) => {
      console.log(`🔌 Cliente desconectado: ${reason}`);
      console.log('🔁 Reconectando...');
      this.client.initialize();
    });

    // Initialize client
    this.client.initialize().catch(err => {
      console.error('❌ Error al inicializar el cliente:', err);
    });
  }

  /**
   * Get or create user session
   */
  getUserSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        step: null,
        data: {},
        lastActivity: Date.now()
      });
    }
    return userSessions.get(userId);
  }

  /**
   * Parse command from message
   */
  parseCommand(message) {
    // Remove special characters and convert to lowercase
    return message.replace(/[^\w\s]/gi, '').trim().toLowerCase();
  }

  /**
   * Handle incoming messages and route to appropriate handler
   */
  async handleIncomingMessage(msg) {
    const message = this.parseCommand(msg.body);
    const from = msg.from;
    const userSession = this.getUserSession(from);

    // Check if user is in the middle of an order
    if (userSession.step) {
      return this.continueOrderProcess(msg, userSession);
    }

    // Handle commands
    switch (message) {
      case 'hola':
      case 'hola!':
      case 'hola,':
      case 'inicio':
      case 'start':
        await this.sendWelcomeMessage(from);
        break;
      
      case 'menu':
      case 'carta':
      case 'productos':
        await this.sendMenu(from);
        break;
      
      case 'pedido':
      case 'orden':
      case 'comprar':
        await this.startNewOrder(from, msg);
        break;
      
      case 'reserva':
      case 'cita':
      case 'reservar':
        await this.handleNewReservation(from, msg);
        break;
      
      case 'estado':
      case 'mipedido':
      case 'micompra':
        await this.checkOrderStatus(from, msg);
        break;
      
      case 'contacto':
      case 'soporte':
      case 'ayuda':
        await this.sendContactInfo(from);
        break;
      
      case 'horario':
      case 'horarios':
        await this.sendBusinessHours(from);
        break;
      
      case 'ubicacion':
      case 'direccion':
      case 'dondeestan':
        await this.sendLocation(from);
        break;
      
      // Admin commands
      case 'admin':
      case 'administrador':
        await this.handleAdminCommand(from, message);
        break;
      
      default:
        await this.handleUnknownMessage(from, message);
    }
  }

  async sendWelcomeMessage(to) {
    const welcomeMessage = `¡Hola! 👋 Soy el asistente virtual de *TuPYME*.\n\n¿En qué puedo ayudarte hoy?\n\nEscribe:\n• *Pedido* - Para realizar un nuevo pedido\n• *Reserva* - Para hacer una reserva\n• *Ayuda* - Para ver más opciones`;
    
    await this.client.sendMessage(to, welcomeMessage);
  }

  async handleNewOrder(from, msg) {
    // This would be more complex in a real implementation
    const response = `📝 *Nuevo Pedido*\n\nPara realizar un pedido, por favor proporciona la siguiente información separada por comas:\n\n1. Tu nombre\n2. Producto que deseas\n3. Cantidad\n4. Fecha de entrega (DD/MM/AAAA)\n\nEjemplo:\n*Pedido, Juan Pérez, Pizza Margarita, 2, 25/12/2023*`;
    
    await this.client.sendMessage(from, response);
    
    // In a real implementation, you would set a state for this user
    // to handle the multi-step order process
  }

  async handleNewReservation(from, msg) {
    const response = `📅 *Nueva Reserva*\n\nPara hacer una reserva, por favor proporciona la siguiente información separada por comas:\n\n1. Tu nombre\n2. Número de personas\n3. Fecha (DD/MM/AAAA)\n4. Hora (HH:MM)\n\nEjemplo:\n*Reserva, Ana García, 4, 25/12/2023, 20:30*`;
    
    await this.client.sendMessage(from, response);
  }

  async sendHelpMessage(to) {
    const helpMessage = `🆘 *Ayuda*\n\nPuedo ayudarte con lo siguiente:\n\n• *Pedido* - Realizar un nuevo pedido\n• *Reserva* - Hacer una reserva\n• *Estado* - Consultar estado de tu pedido\n• *Contacto* - Hablar con un asesor humano\n• *Horario* - Ver horario de atención`;
    
    await this.client.sendMessage(to, helpMessage);
  }

  async handleUnknownMessage(to, message) {
    const unknownMessage = `🤔 No estoy seguro de cómo ayudarte con "${message}".\n\nEscribe *ayuda* para ver las opciones disponibles.`;
    await this.client.sendMessage(to, unknownMessage);
  }

  /**
   * Send the menu to the user
   */
  async sendMenu(to) {
    try {
      let menuMessage = `🍽️ *Menú de ${BUSINESS_CONFIG.name}*\n\n`;
      
      MENU_ITEMS.forEach(item => {
        menuMessage += `*${item.id}.* ${item.name} - $${item.price}\n`;
        menuMessage += `   _${item.description}_\n\n`;
      });
      
      menuMessage += '🛒 Para hacer un pedido, escribe *pedido*';
      
      await this.client.sendMessage(to, menuMessage);
    } catch (error) {
      console.error('Error sending menu:', error);
      await this.client.sendMessage(to, '❌ Ocurrió un error al cargar el menú. Por favor, inténtalo de nuevo más tarde.');
    }
  }

  /**
   * Start a new order process
   */
  async startNewOrder(from, msg) {
    const userSession = this.getUserSession(from);
    userSession.step = 'awaiting_name';
    userSession.order = {
      items: [],
      customerPhone: from.replace('@c.us', '')
    };
    
    await this.client.sendMessage(from, '👋 ¡Perfecto! Vamos a crear un nuevo pedido.\n\nPor favor, escribe tu *nombre completo*:');
  }

  /**
   * Continue order process based on current step
   */
  async continueOrderProcess(msg, userSession) {
    const from = msg.from;
    const message = msg.body.trim();
    
    try {
      switch (userSession.step) {
        case 'awaiting_name':
          userSession.order.customerName = message;
          userSession.step = 'awaiting_item';
          await this.sendMenu(from);
          await this.client.sendMessage(from, '📝 Por favor, escribe el *número* del producto que deseas:');
          break;
          
        case 'awaiting_item':
          const itemId = parseInt(message);
          const selectedItem = MENU_ITEMS.find(item => item.id === itemId);
          
          if (!selectedItem) {
            await this.client.sendMessage(from, '❌ Número de producto inválido. Por favor, elige un número de la lista:');
            await this.sendMenu(from);
            return;
          }
          
          userSession.tempItem = { ...selectedItem };
          userSession.step = 'awaiting_quantity';
          await this.client.sendMessage(from, `🛒 Has seleccionado: *${selectedItem.name}*\n\n¿Cuántas unidades deseas?`);
          break;
          
        case 'awaiting_quantity':
          const quantity = parseInt(message);
          
          if (isNaN(quantity) || quantity < 1) {
            await this.client.sendMessage(from, '❌ Por favor, ingresa una cantidad válida (número mayor a 0):');
            return;
          }
          
          userSession.order.items.push({
            ...userSession.tempItem,
            quantity: quantity
          });
          
          delete userSession.tempItem;
          userSession.step = 'awaiting_more';
          
          const total = userSession.order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          let orderSummary = '📝 *Resumen del Pedido*\n\n';
          userSession.order.items.forEach((item, index) => {
            orderSummary += `${index + 1}. ${item.quantity}x ${item.name} - $${item.price * item.quantity}\n`;
          });
          orderSummary += `\n*Total: $${total}*\n\n`;
          orderSummary += '¿Deseas agregar algo más al pedido? (Sí/No)';
          
          await this.client.sendMessage(from, orderSummary);
          break;
          
        case 'awaiting_more':
          const response = message.toLowerCase();
          
          if (response === 'sí' || response === 'si' || response === 's') {
            userSession.step = 'awaiting_item';
            await this.sendMenu(from);
            await this.client.sendMessage(from, '📝 Por favor, escribe el *número* del producto que deseas agregar:');
          } else if (response === 'no' || response === 'n') {
            await this.completeOrder(from, userSession);
          } else {
            await this.client.sendMessage(from, '❌ Por favor, responde con *Sí* o *No*:');
          }
          break;
      }
    } catch (error) {
      console.error('Error in order process:', error);
      await this.client.sendMessage(from, '❌ Ocurrió un error al procesar tu pedido. Por favor, inicia de nuevo.');
      this.resetUserSession(from);
    }
  }

  /**
   * Complete the order and save to database
   */
  async completeOrder(from, userSession) {
    try {
      const orderData = {
        ...userSession.order,
        totalAmount: userSession.order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        status: 'pending',
        createdAt: new Date()
      };
      
      // Save to database
      const order = new Order(orderData);
      const savedOrder = await order.save();
      
      // Send confirmation to customer
      await this.sendOrderConfirmation(from, {
        ...savedOrder._doc,
        orderId: savedOrder._id.toString().substring(18, 24).toUpperCase()
      });
      
      // Reset session
      this.resetUserSession(from);
      
    } catch (error) {
      console.error('Error saving order:', error);
      await this.client.sendMessage(from, '❌ Ocurrió un error al guardar tu pedido. Por favor, inténtalo de nuevo.');
      this.resetUserSession(from);
    }
  }

  /**
   * Reset user session
   */
  resetUserSession(userId) {
    userSessions.set(userId, {
      step: null,
      data: {},
      lastActivity: Date.now()
    });
  }

  /**
   * Send order confirmation to customer
   */
  async sendOrderConfirmation(to, orderDetails) {
    try {
      const message = `✅ *¡Pedido Confirmado!*\n\n` +
        `N° de Pedido: *${orderDetails.orderId || 'PENDIENTE'}*\n` +
        `Fecha: *${new Date(orderDetails.createdAt).toLocaleString()}*\n` +
        `Estado: *${this.getStatusText(orderDetails.status)}*\n\n` +
        `*Detalles del Pedido:*\n${orderDetails.items.map(item => `• ${item.quantity}x ${item.name} - $${item.price * item.quantity}`).join('\n')}\n\n` +
        `*Total: $${orderDetails.totalAmount.toFixed(2)}*\n\n` +
        `¡Gracias por tu compra! Te notificaremos cuando tu pedido esté listo.`;
      
      await this.client.sendMessage(to, message);
      
      // Notify admin
      if (BUSINESS_CONFIG.adminPhone) {
        await this.notifyAdmin(`Nuevo pedido #${orderDetails.orderId} recibido de ${orderDetails.customerName} por $${orderDetails.totalAmount}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error sending order confirmation:', error);
      return false;
    }
  }

  /**
   * Check order status
   */
  async checkOrderStatus(from, msg) {
    try {
      await this.client.sendMessage(from, '🔍 Por favor, escribe el número de pedido que deseas consultar:');
      // In a real implementation, you would handle the response and query the database
    } catch (error) {
      console.error('Error checking order status:', error);
      await this.client.sendMessage(from, '❌ Ocurrió un error al consultar el estado del pedido.');
    }
  }

  /**
   * Send business contact information
   */
  async sendContactInfo(to) {
    const contactMessage = `📞 *Contacto*\n\n` +
      `*${BUSINESS_CONFIG.name}*\n` +
      `📱 Teléfono: ${BUSINESS_CONFIG.phone}\n` +
      `📍 Dirección: ${BUSINESS_CONFIG.address}\n\n` +
      `Horario de atención:\n${BUSINESS_CONFIG.hours}`;
    
    await this.client.sendMessage(to, contactMessage);
  }

  /**
   * Send business hours
   */
  async sendBusinessHours(to) {
    const hoursMessage = `🕒 *Horario de Atención*\n\n${BUSINESS_CONFIG.hours}\n\n` +
      `Para realizar un pedido fuera de horario, puedes hacerlo por este medio y lo atenderemos a la brevedad.`;
    
    await this.client.sendMessage(to, hoursMessage);
  }

  /**
   * Send business location
   */
  async sendLocation(to) {
    const locationMessage = `📍 *Nuestra Ubicación*\n\n${BUSINESS_CONFIG.address}\n\n` +
      `¡Te esperamos!`;
    
    await this.client.sendMessage(to, locationMessage);
    
    // In a real implementation, you could send an actual location pin
    // await this.client.sendMessage(to, '', { location: { lat: -34.6037, lng: -58.3816 } });
  }

  /**
   * Handle admin commands
   */
  async handleAdminCommand(from, command) {
    // Verify if the user is an admin
    const userPhone = from.replace('@c.us', '');
    if (userPhone !== BUSINESS_CONFIG.adminPhone.replace(/\D/g, '')) {
      await this.client.sendMessage(from, '❌ No tienes permisos para ejecutar este comando.');
      return;
    }
    
    // Handle different admin commands
    const adminCommand = command.split(' ')[1];
    
    switch (adminCommand) {
      case 'pedidos':
        await this.listOrders(from);
        break;
      case 'estadisticas':
        await this.showStats(from);
        break;
      default:
        await this.client.sendMessage(from, '📋 *Comandos de Administración*\n\n' +
          '• *admin pedidos* - Ver pedidos recientes\n' +
          '• *admin estadisticas* - Ver estadísticas\n' +
          '• *admin ayuda* - Mostrar esta ayuda');
    }
  }

  /**
   * List recent orders (admin)
   */
  async listOrders(to) {
    try {
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5);
      
      if (orders.length === 0) {
        await this.client.sendMessage(to, '📭 No hay pedidos recientes.');
        return;
      }
      
      let message = '📋 *Últimos Pedidos*\n\n';
      
      orders.forEach(order => {
        const orderId = order._id.toString().substring(18, 24).toUpperCase();
        message += `*#${orderId}* - ${order.customerName}\n`;
        message += `📅 ${new Date(order.createdAt).toLocaleString()}\n`;
        message += `🛒 ${order.items.length} productos - $${order.totalAmount.toFixed(2)}\n`;
        message += `📊 Estado: ${this.getStatusText(order.status)}\n\n`;
      });
      
      await this.client.sendMessage(to, message);
      
    } catch (error) {
      console.error('Error listing orders:', error);
      await this.client.sendMessage(to, '❌ Ocurrió un error al listar los pedidos.');
    }
  }

  /**
   * Show statistics (admin)
   */
  async showStats(to) {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);
      
      let message = '📊 *Estadísticas*\n\n';
      
      stats.forEach(stat => {
        message += `*${this.getStatusText(stat._id)}*\n`;
        message += `  • Cantidad: ${stat.count}\n`;
        message += `  • Total: $${stat.totalAmount.toFixed(2)}\n\n`;
      });
      
      const totalOrders = await Order.countDocuments();
      const totalRevenue = (await Order.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]))[0]?.total || 0;
      
      message += `*Totales*\n`;
      message += `  • Pedidos: ${totalOrders}\n`;
      message += `  • Ingresos: $${totalRevenue.toFixed(2)}`;
      
      await this.client.sendMessage(to, message);
      
    } catch (error) {
      console.error('Error showing stats:', error);
      await this.client.sendMessage(to, '❌ Ocurrió un error al mostrar las estadísticas.');
    }
  }

  /**
   * Get status text in Spanish
   */
  getStatusText(status) {
    const statusMap = {
      'pending': '🔄 Pendiente',
      'confirmed': '✅ Confirmado',
      'preparing': '👨‍🍳 En preparación',
      'ready': '🛍️ Listo para retirar',
      'completed': '🏁 Completado',
      'cancelled': '❌ Cancelado'
    };
    return statusMap[status] || status;
  }

  /**
   * Notify admin about important events
   */
  async notifyAdmin(message) {
    if (!BUSINESS_CONFIG.adminPhone) return;
    
    try {
      await this.client.sendMessage(
        `${BUSINESS_CONFIG.adminPhone}@c.us`,
        `🔔 *Notificación del Sistema*\n\n${message}`
      );
    } catch (error) {
      console.error('Error notifying admin:', error);
    }
  }
}

module.exports = new WhatsAppBot();
