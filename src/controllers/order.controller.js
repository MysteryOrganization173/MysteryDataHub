import { Order } from '../models/Order.js';
import { syncOrderProviderStatus } from '../services/fulfillment.service.js';
import { roundMoney } from '../utils/agent.utils.js';

function serializeOrder(orderInput) {
  const order = orderInput?.toObject ? orderInput.toObject() : orderInput;
  return {
    orderId: order.orderId,
    reference: order.reference,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail || '',
    network: order.network,
    tier: order.catalogTier,
    tierLabel: order.tierLabel || order.catalogTier,
    bundleCode: order.bundleCode,
    bundleName: order.bundleName,
    amount: roundMoney(order.amount || 0),
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    status: order.status,
    createdAt: order.createdAt
  };
}

export const getOrderStatus = async (req, res) => {
  try {
    const lookup = String(req.params.lookup || '').trim();
    if (!lookup) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Order reference is required'
      });
    }

    let order = await Order.findOne({
      $or: [{ orderId: lookup }, { reference: lookup }]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        status: 'error',
        message: 'Order not found'
      });
    }

    order = await syncOrderProviderStatus(order, { force: true, source: 'track-order' });

    return res.json({
      success: true,
      status: 'success',
      order: serializeOrder(order)
    });
  } catch (err) {
    console.error('[GET /api/orders/:lookup]', err);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Could not fetch order status'
    });
  }
};
