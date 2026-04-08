export const createOrder = async (req, res) => {
  try {
    const { phone, bundle } = req.body;

    if (phone === undefined || phone === null || String(phone).trim() === '') {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Phone is required'
      });
    }

    if (bundle === undefined || bundle === null || String(bundle).trim() === '') {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Bundle is required'
      });
    }

    const payload = { phone: String(phone).trim(), bundle: String(bundle).trim() };
    console.log('[POST /api/orders/create]', payload);

    return res.status(200).json({
      success: true,
      status: 'success',
      message: 'Order received. We will process your bundle shortly.',
      data: payload
    });
  } catch (err) {
    console.error('[POST /api/orders/create]', err);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Could not create order'
    });
  }
};
