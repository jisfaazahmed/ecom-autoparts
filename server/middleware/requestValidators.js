const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

function fail(res, message) {
  return res.status(400).json({ success: false, message });
}

function asTrimmed(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isObjectId(value) {
  return OBJECT_ID_RE.test(asTrimmed(value));
}

// Number() coerces booleans and single-element arrays (Number(true) === 1,
// Number([3]) === 3), so those slipped through as valid quantities. Accept only a real
// number or a numeric string; anything else yields NaN and fails the caller's range check.
function toInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : NaN;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : NaN;
  }
  return NaN;
}

function validateObjectIdParam(paramName, label = paramName) {
  return (req, res, next) => {
    if (!isObjectId(req.params?.[paramName])) {
      return fail(res, `Invalid ${label}`);
    }
    return next();
  };
}

function validatePaginationQuery(req, res, next) {
  const { page = '1', limit = '10' } = req.query || {};
  const pageNum = toInteger(page);
  const limitNum = toInteger(limit);

  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return fail(res, 'page must be a positive integer');
  }

  if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
    return fail(res, 'limit must be an integer between 1 and 100');
  }

  // Express 5 exposes req.query as a getter that re-parses the query string on every
  // access, so assigning to it is silently discarded - the old `req.query.page = pageNum`
  // never reached the handler, and the defaults above never applied. Publish the parsed
  // values on the request itself, which is a plain property and does persist.
  req.pagination = { page: pageNum, limit: limitNum };
  return next();
}

function validateCartAdd(req, res, next) {
  const productId = asTrimmed(req.body?.productId);
  const quantity = toInteger(req.body?.quantity ?? 1);

  if (!isObjectId(productId)) {
    return fail(res, 'Invalid productId');
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return fail(res, 'quantity must be an integer between 1 and 999');
  }

  req.body.productId = productId;
  req.body.quantity = quantity;
  return next();
}

function validateCartUpdate(req, res, next) {
  if (!isObjectId(req.params?.productId)) {
    return fail(res, 'Invalid productId');
  }

  const quantity = toInteger(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return fail(res, 'quantity must be an integer between 1 and 999');
  }

  req.body.quantity = quantity;
  return next();
}

function validateAuthRegister(req, res, next) {
  const displayName = asTrimmed(req.body?.name || req.body?.fullName);
  const email = asTrimmed(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');
  const roleRaw = asTrimmed(req.body?.role || 'CUSTOMER').toUpperCase();
  const shopName = asTrimmed(req.body?.shopName);
  const phone = asTrimmed(req.body?.phone);
  const address = asTrimmed(req.body?.address);

  if (!displayName || displayName.length < 2 || displayName.length > 120) {
    return fail(res, 'Name must be between 2 and 120 characters');
  }

  if (!EMAIL_RE.test(email)) {
    return fail(res, 'Invalid email format');
  }

  if (password.length < 6 || password.length > 128) {
    return fail(res, 'Password must be between 6 and 128 characters');
  }

  if (!['CUSTOMER', 'ADMIN'].includes(roleRaw)) {
    return fail(res, 'Invalid role');
  }

  if (roleRaw === 'ADMIN' && (!shopName || shopName.length < 2 || shopName.length > 120)) {
    return fail(res, 'shopName is required for ADMIN registration');
  }

  // Both are optional at signup, so only validate what was actually filled in.
  if (phone && !PHONE_RE.test(phone)) {
    return fail(res, 'Invalid phone format');
  }

  if (address && (address.length < 3 || address.length > 250)) {
    return fail(res, 'Address must be between 3 and 250 characters');
  }

  req.body.email = email;
  req.body.role = roleRaw;
  req.body.phone = phone;
  req.body.address = address;
  return next();
}

function validateAuthLogin(req, res, next) {
  const email = asTrimmed(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');

  if (!EMAIL_RE.test(email)) {
    return fail(res, 'Invalid email format');
  }

  if (!password) {
    return fail(res, 'Password is required');
  }

  req.body.email = email;
  return next();
}

function validateForgotPassword(req, res, next) {
  const email = asTrimmed(req.body?.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return fail(res, 'Invalid email format');
  }
  req.body.email = email;
  return next();
}

function validateResetPassword(req, res, next) {
  const token = asTrimmed(req.body?.token);
  const password = String(req.body?.password || '');
  const confirm = String(req.body?.passwordConfirm || '');

  if (!token || token.length < 16 || token.length > 256) {
    return fail(res, 'Invalid reset token');
  }

  if (password.length < 6 || password.length > 128) {
    return fail(res, 'Password must be between 6 and 128 characters');
  }

  if (password !== confirm) {
    return fail(res, 'Passwords do not match');
  }

  return next();
}

function validateChangePassword(req, res, next) {
  const current = String(req.body?.currentPassword || '');
  const nextPassword = String(req.body?.newPassword || '');
  const confirm = String(req.body?.passwordConfirm || '');

  if (!current) {
    return fail(res, 'Current password is required');
  }

  if (nextPassword.length < 6 || nextPassword.length > 128) {
    return fail(res, 'New password must be between 6 and 128 characters');
  }

  if (nextPassword !== confirm) {
    return fail(res, 'New passwords do not match');
  }

  return next();
}

// Optional profile fields are clearable: the controllers write through on any value that
// is not undefined, so null / "" means "remove this", not "invalid".
function isClearing(value) {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function checkOptionalText(value, label, min, max) {
  if (value === undefined || isClearing(value)) return null;
  if (typeof value !== 'string') return `${label} must be a string`;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return `${label} must be a string between ${min} and ${max} characters`;
  }
  return null;
}

function validateUpdateProfile(req, res, next) {
  const body = req.body || {};
  // Both casings reach this middleware: /api/auth/profile sends fullName, the client's
  // /api/users/profile sends full_name, and the controllers read either.
  const { name, fullName, full_name: fullNameSnake, phone, address, city } = body;
  const postalCode = body.postalCode !== undefined ? body.postalCode : body.postal_code;
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : body.avatar_url;

  for (const [value, label] of [[name, 'name'], [fullName, 'fullName'], [fullNameSnake, 'full_name']]) {
    // A name may be changed or left alone, but not blanked - it is a required column.
    if (value !== undefined && (typeof value !== 'string' || asTrimmed(value).length < 2 || asTrimmed(value).length > 120)) {
      return fail(res, `${label} must be a string between 2 and 120 characters`);
    }
  }

  if (phone !== undefined && !isClearing(phone)) {
    if (typeof phone !== 'string' || !PHONE_RE.test(asTrimmed(phone))) {
      return fail(res, 'Invalid phone format');
    }
  }

  const textError =
    checkOptionalText(address, 'address', 3, 250) ||
    checkOptionalText(city, 'city', 2, 100);
  if (textError) {
    return fail(res, textError);
  }

  if (postalCode !== undefined && !isClearing(postalCode)) {
    const normalized = asTrimmed(postalCode);
    if (typeof postalCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 -]{1,19}$/.test(normalized)) {
      return fail(res, 'postalCode must be 2-20 letters, digits, spaces or hyphens');
    }
  }

  if (avatarUrl !== undefined && !isClearing(avatarUrl)) {
    const normalized = asTrimmed(avatarUrl);
    // Only http(s) or a site-relative path. Anything else (javascript:, data:, vbscript:)
    // is a stored-XSS vector the moment this value is rendered into an href.
    const isSafe = /^https?:\/\/[^\s]+$/i.test(normalized) || /^\/[^\s]*$/.test(normalized);
    if (typeof avatarUrl !== 'string' || !isSafe || normalized.length > 2048) {
      return fail(res, 'avatarUrl must be an http(s) or site-relative URL up to 2048 characters');
    }
  }

  return next();
}

function validateRegisterVerify(req, res, next) {
  const verificationId = asTrimmed(req.body?.verificationId);
  const otp = asTrimmed(req.body?.otp);

  if (!isObjectId(verificationId)) {
    return fail(res, 'Invalid verificationId');
  }

  if (!/^\d{6}$/.test(otp)) {
    return fail(res, 'Invalid OTP format');
  }

  return next();
}

function validateRegisterResend(req, res, next) {
  const verificationId = asTrimmed(req.body?.verificationId);

  if (!isObjectId(verificationId)) {
    return fail(res, 'Invalid verificationId');
  }

  return next();
}

function validateOrderIdBody(req, res, next) {
  if (!isObjectId(req.body?.orderId)) {
    return fail(res, 'Invalid orderId');
  }
  return next();
}

function validateCreatePaymentIntent(req, res, next) {
  if (!isObjectId(req.body?.orderId)) {
    return fail(res, 'Invalid orderId');
  }

  return next();
}

function validateConfirmPaymentIntent(req, res, next) {
  const orderId = asTrimmed(req.body?.orderId);
  const paymentIntentId = asTrimmed(req.body?.paymentIntentId);

  if (!isObjectId(orderId)) {
    return fail(res, 'Invalid orderId');
  }

  if (!paymentIntentId || paymentIntentId.length < 6 || paymentIntentId.length > 128) {
    return fail(res, 'Invalid paymentIntentId');
  }

  return next();
}

function validateRetryPaymentIntent(req, res, next) {
  const otp = req.body?.otp;
  if (otp !== undefined && otp !== null && otp !== '') {
    const code = asTrimmed(otp);
    if (!/^\d{4,8}$/.test(code)) {
      return fail(res, 'Invalid OTP format');
    }
  }

  return validateConfirmPaymentIntent(req, res, next);
}

function validateConfirmCardPayment(req, res, next) {
  if (!isObjectId(req.params?.paymentId)) {
    return fail(res, 'Invalid paymentId');
  }

  const paymentIntentId = asTrimmed(req.body?.paymentIntentId);
  if (!paymentIntentId || paymentIntentId.length < 6 || paymentIntentId.length > 128) {
    return fail(res, 'Invalid paymentIntentId');
  }

  return next();
}

function validateVerifyCOD(req, res, next) {
  if (!isObjectId(req.params?.paymentId)) {
    return fail(res, 'Invalid paymentId');
  }

  const status = asTrimmed(req.body?.status).toLowerCase();
  const notes = req.body?.notes;
  const allowed = new Set(['success', 'no_answer', 'wrong_number', 'customer_refused', 'number_busy', 'failed']);

  if (!allowed.has(status)) {
    return fail(res, 'Invalid COD verification status');
  }

  if (notes !== undefined && (typeof notes !== 'string' || asTrimmed(notes).length > 500)) {
    return fail(res, 'notes must be a string up to 500 characters');
  }

  req.body.status = status;
  return next();
}

function validateConfirmCODCollection(req, res, next) {
  if (!isObjectId(req.params?.paymentId)) {
    return fail(res, 'Invalid paymentId');
  }

  const amount = Number(req.body?.amount);
  const collectedBy = asTrimmed(req.body?.collectedBy);
  const changeAmount = req.body?.changeAmount === undefined ? 0 : Number(req.body?.changeAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return fail(res, 'amount must be a positive number');
  }

  if (!collectedBy || collectedBy.length > 120) {
    return fail(res, 'collectedBy is required and must be up to 120 characters');
  }

  if (!Number.isFinite(changeAmount) || changeAmount < 0) {
    return fail(res, 'changeAmount must be a non-negative number');
  }

  req.body.amount = amount;
  req.body.changeAmount = changeAmount;
  req.body.collectedBy = collectedBy;
  return next();
}

function validateWalletPay(req, res, next) {
  if (!isObjectId(req.body?.orderId)) {
    return fail(res, 'Invalid orderId');
  }

  const otp = req.body?.otp;
  if (otp !== undefined && otp !== null && otp !== '') {
    const code = asTrimmed(otp);
    if (!/^\d{4,8}$/.test(code)) {
      return fail(res, 'Invalid OTP format');
    }
  }

  return next();
}

function validateWalletTopupIntent(req, res, next) {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail(res, 'A valid amount is required');
  }
  req.body.amount = amount;
  return next();
}

function validateWalletTopupConfirm(req, res, next) {
  const paymentIntentId = asTrimmed(req.body?.paymentIntentId);
  if (!paymentIntentId) {
    return fail(res, 'paymentIntentId is required');
  }
  req.body.paymentIntentId = paymentIntentId;
  return next();
}

function validateProcessRefund(req, res, next) {
  if (!isObjectId(req.params?.paymentId)) {
    return fail(res, 'Invalid paymentId');
  }

  const amount = req.body?.amount;
  if (amount !== undefined) {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fail(res, 'amount must be a positive number');
    }
    req.body.amount = parsed;
  }

  if (req.body?.reason !== undefined) {
    const reason = asTrimmed(req.body.reason);
    if (!reason || reason.length > 250) {
      return fail(res, 'reason must be 1-250 characters');
    }
    req.body.reason = reason;
  }

  return next();
}

function validateShippingCalculate(req, res, next) {
  const body = req.body || {};
  const items = body.items;
  const deliveryAddress = body.deliveryAddress;
  const shippingMethod = asTrimmed(body.shippingMethod || 'standard').toLowerCase();

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 'items must be a non-empty array');
  }

  if (items.length > 100) {
    return fail(res, 'items cannot exceed 100 entries');
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const quantity = toInteger(item?.quantity);
    const price = Number(item?.product?.price);
    const weight = item?.product?.weight === undefined ? 0.5 : Number(item.product.weight);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return fail(res, `items[${i}].quantity must be an integer between 1 and 999`);
    }

    if (!Number.isFinite(price) || price < 0) {
      return fail(res, `items[${i}].product.price must be a non-negative number`);
    }

    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) {
      return fail(res, `items[${i}].product.weight must be a positive number`);
    }
  }

  if (!deliveryAddress || typeof deliveryAddress !== 'object' || Array.isArray(deliveryAddress)) {
    return fail(res, 'deliveryAddress must be an object');
  }

  const district = asTrimmed(deliveryAddress.district || deliveryAddress.city);
  if (!district || district.length > 100) {
    return fail(res, 'deliveryAddress.district or city is required');
  }

  const allowedMethods = new Set(['standard', 'express', 'same_day', 'next_day', 'pickup_point']);
  if (!allowedMethods.has(shippingMethod)) {
    return fail(res, 'Invalid shippingMethod');
  }

  req.body.shippingMethod = shippingMethod;
  return next();
}

function validateShippingStatusUpdate(req, res, next) {
  if (!isObjectId(req.params?.shippingId)) {
    return fail(res, 'Invalid shippingId');
  }

  const status = asTrimmed(req.body?.status).toLowerCase();
  const allowed = new Set([
    'label_created',
    'pickup_scheduled',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'delivery_attempted',
    'failed',
    'returned_to_sender',
    'cancelled',
    'on_hold',
    'lost',
    'damaged',
  ]);

  if (!allowed.has(status)) {
    return fail(res, 'Invalid shipment status');
  }

  req.body.status = status;
  return next();
}

function validateDeliveryAttempt(req, res, next) {
  if (!isObjectId(req.params?.shippingId)) {
    return fail(res, 'Invalid shippingId');
  }

  const status = asTrimmed(req.body?.status).toLowerCase();
  const allowed = new Set(['delivered', 'failed', 'rescheduled', 'customer_not_available', 'wrong_address']);

  if (!allowed.has(status)) {
    return fail(res, 'Invalid delivery attempt status');
  }

  req.body.status = status;
  return next();
}

function validateSubmitRating(req, res, next) {
  if (!isObjectId(req.params?.shippingId)) {
    return fail(res, 'Invalid shippingId');
  }

  const rating = toInteger(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail(res, 'rating must be an integer between 1 and 5');
  }

  if (req.body?.comment !== undefined) {
    const comment = asTrimmed(req.body.comment);
    if (comment.length > 500) {
      return fail(res, 'comment must be up to 500 characters');
    }
    req.body.comment = comment;
  }

  req.body.rating = rating;
  return next();
}

function validateReportIssue(req, res, next) {
  if (!isObjectId(req.params?.shippingId)) {
    return fail(res, 'Invalid shippingId');
  }

  const type = asTrimmed(req.body?.type).toLowerCase();
  const severity = asTrimmed(req.body?.severity).toLowerCase();
  const description = asTrimmed(req.body?.description);

  const allowedTypes = new Set(['delay', 'damage', 'lost', 'wrong_address', 'customs_hold', 'weather', 'vehicle_breakdown', 'other']);
  const allowedSeverity = new Set(['low', 'medium', 'high', 'critical']);

  if (!allowedTypes.has(type)) {
    return fail(res, 'Invalid issue type');
  }

  if (!allowedSeverity.has(severity)) {
    return fail(res, 'Invalid issue severity');
  }

  if (!description || description.length > 1000) {
    return fail(res, 'description is required and must be up to 1000 characters');
  }

  req.body.type = type;
  req.body.severity = severity;
  req.body.description = description;
  return next();
}

function validateTrackingNumber(req, res, next) {
  const trackingNumber = asTrimmed(req.params?.trackingNumber);
  if (!trackingNumber || trackingNumber.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(trackingNumber)) {
    return fail(res, 'Invalid tracking number');
  }
  req.params.trackingNumber = trackingNumber;
  return next();
}

function validateInventoryCheck(req, res, next) {
  if (!isObjectId(req.body?.productId)) {
    return fail(res, 'Invalid productId');
  }

  const quantity = toInteger(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return fail(res, 'quantity must be an integer between 1 and 9999');
  }

  req.body.quantity = quantity;
  return next();
}

module.exports = {
  validateObjectIdParam,
  validatePaginationQuery,
  validateCartAdd,
  validateCartUpdate,
  validateAuthRegister,
  validateAuthLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateUpdateProfile,
  validateRegisterVerify,
  validateRegisterResend,
  validateOrderIdBody,
  validateCreatePaymentIntent,
  validateConfirmPaymentIntent,
  validateRetryPaymentIntent,
  validateConfirmCardPayment,
  validateVerifyCOD,
  validateConfirmCODCollection,
  validateWalletPay,
  validateWalletTopupIntent,
  validateWalletTopupConfirm,
  validateProcessRefund,
  validateShippingCalculate,
  validateShippingStatusUpdate,
  validateDeliveryAttempt,
  validateSubmitRating,
  validateReportIssue,
  validateTrackingNumber,
  validateInventoryCheck,
};
