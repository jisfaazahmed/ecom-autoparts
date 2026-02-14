const Payment = require('../models/payment.model');
const paymentService = require('../services/payment.service');

//create payment
exports.createPayment = async (req, res) => {
    try {
        const payment = await paymentService.initiatePayment(
            req.params.orderId,
            req.user._id,
            {
                ...req.body,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        );

        res.status(200).json(
            {
                data: payment,
                message: 'Payment initiated'
            }
        )
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// Card payment confirmation
exports.confirmCardPayment = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        const payment = await paymentService.confirmCardPayment(
            req.params.paymentId,
            paymentIntentId
        );

        res.status(200).json({
            data: payment
        });
    } catch (error) {
        res.status(400).json(
            {
                success: false,
                message: error.message
            }
        );
    }
}

// Verify COD
exports.verifyCOD = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const payment = await paymentService.verifyCOD(
      req.params.paymentId,
      req.user._id,
      status,
      notes
    );
    
    res.json({
      success: true,
      message: 'COD verification updated',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

//confirm cod
exports.confirmCODCollection = async (req, res) => {
  try {
    const payment = await paymentService.confirmCODCollection(
      req.params.paymentId,
      req.body
    );
    
    res.json({
      success: true,
      message: 'COD collection confirmed',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.processRefund = async (req, res) => {
  try {
    const payment = await paymentService.processRefund(
      req.params.paymentId,
      {
        ...req.body,
        initiatedBy: req.user._id
      }
    );
    
    res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentDetails(
      req.params.paymentId,
      req.user._id
    );
    
    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get User Payments
exports.getUserPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;
    
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;