const Order = require('../models/Order');
const { sendOrderUpdate } = require('../services/notificationService');

/**
 * Create a new order
 * @route POST /api/orders
 */
exports.createOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, items, totalAmount, scheduledDate, notes } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !items || !totalAmount || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporcione todos los campos requeridos.'
      });
    }

    // Create new order
    const newOrder = new Order({
      customerName,
      customerPhone: customerPhone.replace(/[^\d]/g, ''), // Remove any non-numeric characters
      items: Array.isArray(items) ? items : [items],
      totalAmount,
      scheduledDate: new Date(scheduledDate),
      notes: notes || '',
      status: 'pending'
    });

    // Save order to database
    const savedOrder = await newOrder.save();

    // Send order confirmation to customer
    await sendOrderUpdate(customerPhone, savedOrder, 'new_order');

    res.status(201).json({
      success: true,
      data: savedOrder,
      message: 'Pedido creado exitosamente.'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el pedido.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all orders
 * @route GET /api/orders
 */
exports.getOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, sortBy = '-createdAt' } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }
    
    // Execute query
    const orders = await Order.find(query)
      .sort(sortBy)
      .lean();
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los pedidos.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get order by ID
 * @route GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update order status
 * @route PATCH /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    
    // Validate status
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Estado no válido. Los estados válidos son: ${validStatuses.join(', ')}`
      });
    }
    
    // Find and update order
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.'
      });
    }
    
    // Notify customer about status change
    await sendOrderUpdate(order.customerPhone, order, 'status_change');
    
    res.status(200).json({
      success: true,
      data: order,
      message: `Estado del pedido actualizado a: ${status}`
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del pedido.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete an order
 * @route DELETE /api/orders/:id
 */
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Pedido eliminado exitosamente.'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el pedido.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get order statistics
 * @route GET /api/orders/stats
 */
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $addFields: { status: '$_id' }
      },
      {
        $project: { _id: 0 }
      }
    ]);
    
    // Calculate totals
    const totalOrders = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalRevenue = stats.reduce((sum, stat) => sum + stat.totalAmount, 0);
    
    res.status(200).json({
      success: true,
      data: {
        stats,
        totalOrders,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de pedidos.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
