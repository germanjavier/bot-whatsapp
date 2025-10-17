const whatsappBot = require('./botService');

/**
 * Sends a notification to the admin about a new order
 * @param {string} message - The notification message to send
 * @returns {Promise<boolean>} - True if notification was sent successfully
 */
async function sendNotification(message) {
  try {
    if (!process.env.ADMIN_PHONE) {
      console.warn('ADMIN_PHONE not set. Cannot send notification.');
      return false;
    }

    const formattedMessage = `🔔 *Notificación Importante*\n\n${message}`;
    await whatsappBot.client.sendMessage(
      `${process.env.ADMIN_PHONE}@c.us`,
      formattedMessage
    );
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Sends an order update to the customer
 * @param {string} phoneNumber - Customer's phone number with country code (no + or 00)
 * @param {Object} order - Order details
 * @param {string} updateType - Type of update (status_change, payment_received, etc.)
 * @returns {Promise<boolean>} - True if notification was sent successfully
 */
async function sendOrderUpdate(phoneNumber, order, updateType = 'status_change') {
  try {
    let message = '';
    const orderId = order._id.toString().substr(-6).toUpperCase();
    
    switch (updateType) {
      case 'status_change':
        message = `📦 *Actualización de Pedido #${orderId}*\n\n` +
          `El estado de tu pedido ha cambiado a: *${getStatusText(order.status)}*\n\n`;
        break;
        
      case 'payment_received':
        message = `💳 *Pago Confirmado*\n\n` +
          `Hemos recibido tu pago por el pedido #${orderId}.\n` +
          `Monto: *$${order.totalAmount.toFixed(2)}*\n\n`;
        break;
        
      default:
        message = `ℹ️ *Actualización de Pedido #${orderId}*\n\n`;
    }
    
    // Add order details if not already included
    if (!message.includes('detalles')) {
      message += `*Detalles del Pedido:*\n` +
        `${order.items.map(item => `• ${item.quantity}x ${item.name}`).join('\n')}\n\n` +
        `*Total: $${order.totalAmount.toFixed(2)}*`;
    }
    
    // Add next steps or additional info based on status
    if (order.status === 'preparing') {
      message += '\n\nTu pedido está siendo preparado. Te notificaremos cuando esté listo para retirar.';
    } else if (order.status === 'ready') {
      message += '\n\n¡Tu pedido está listo para ser retirado! ¡Te esperamos pronto!';
    }
    
    await whatsappBot.client.sendMessage(`${phoneNumber}@c.us`, message);
    return true;
  } catch (error) {
    console.error('Error sending order update:', error);
    return false;
  }
}

/**
 * Sends a reminder to the customer about an upcoming reservation
 * @param {string} phoneNumber - Customer's phone number
 * @param {Object} reservation - Reservation details
 * @returns {Promise<boolean>} - True if reminder was sent successfully
 */
async function sendReservationReminder(phoneNumber, reservation) {
  try {
    const message = `⏰ *Recordatorio de Reserva*\n\n` +
      `¡Hola ${reservation.customerName}! Solo un recordatorio de tu reserva para:\n\n` +
      `📅 Fecha: *${new Date(reservation.date).toLocaleDateString()}*\n` +
      `🕒 Hora: *${reservation.time}*\n` +
      `👥 Personas: *${reservation.peopleCount}*\n\n` +
      `¡Esperamos verte pronto!`;
    
    await whatsappBot.client.sendMessage(`${phoneNumber}@c.us`, message);
    return true;
  } catch (error) {
    console.error('Error sending reservation reminder:', error);
    return false;
  }
}

/**
 * Helper function to get status text in Spanish
 * @param {string} status - Order status
 * @returns {string} - Formatted status text
 */
function getStatusText(status) {
  const statusMap = {
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'preparing': 'En preparación',
    'ready': 'Listo para retirar',
    'completed': 'Completado',
    'cancelled': 'Cancelado'
  };
  return statusMap[status] || status;
}

module.exports = {
  sendNotification,
  sendOrderUpdate,
  sendReservationReminder
};
