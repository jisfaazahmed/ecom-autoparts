const base = process.env.QA_BASE_URL || 'http://localhost:5000/api';

const customerEmail = process.env.QA_CUSTOMER_EMAIL || 'sarafroshan40@gmail.com';
const seller1Email = process.env.QA_SELLER1_EMAIL || 'sarafroshan39@gmail.com';
const seller2Email = process.env.QA_SELLER2_EMAIL || 'sarafroshan49@gmail.com';
const password = process.env.QA_PASSWORD || 'QaTest@123';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }

  return { status: res.status, data };
}

(async () => {
  const report = {
    timestamp: new Date().toISOString(),
    base,
    checks: [],
  };

  const customer = await req('POST', '/auth/login', { email: customerEmail, password });
  const seller1 = await req('POST', '/auth/login', { email: seller1Email, password });
  const seller2 = await req('POST', '/auth/login', { email: seller2Email, password });

  const customerToken = customer.data?.accessToken;
  const seller1Token = seller1.data?.accessToken;

  report.checks.push({ area: 'auth', check: 'customer login', status: customer.status, pass: customer.status === 200 });
  report.checks.push({ area: 'auth', check: 'seller1 login', status: seller1.status, pass: seller1.status === 200 });
  report.checks.push({ area: 'auth', check: 'seller2 login', status: seller2.status, pass: seller2.status === 200 });

  const products = await req('GET', '/products');
  const product = Array.isArray(products.data) ? products.data.find((p) => p.stock > 0) : null;
  if (!product) {
    throw new Error('No in-stock product found for QA run');
  }

  const shippingAddress = {
    fullName: 'QA Customer',
    phone: '0712345678',
    addressLine1: '123 QA Street',
    city: 'Colombo',
    district: 'Colombo',
    postalCode: '10100',
    country: 'Sri Lanka',
  };

  const createOrderValid = await req('POST', '/orders', {
    paymentMethod: 'cod',
    shippingAddress,
    shippingMethod: 'standard',
    items: [{ productId: product._id, quantity: 1, vendor: seller1.data?.user?.id }],
  }, customerToken);

  const orderId = createOrderValid.data?.order?._id;
  const orderItemId = createOrderValid.data?.order?.items?.[0];

  report.checks.push({
    area: 'order',
    check: 'create order with valid seller',
    status: createOrderValid.status,
    pass: createOrderValid.status === 200,
    detail: createOrderValid.data?.order?.orderNumber,
  });

  const createOrderSpoof = await req('POST', '/orders', {
    paymentMethod: 'cod',
    shippingAddress,
    shippingMethod: 'standard',
    items: [{ productId: product._id, quantity: 1, vendor: seller2.data?.user?.id }],
  }, customerToken);

  report.checks.push({
    area: 'order',
    check: 'spoof seller without active offer blocked',
    status: createOrderSpoof.status,
    pass: createOrderSpoof.status >= 400,
    detail: createOrderSpoof.data?.message,
  });

  const unauthPayment = await req('PATCH', `/orders/${orderId}/payment-status`, {
    paymentStatus: 'completed',
    transactionId: 'QA-UNAUTH-FINAL',
  });

  report.checks.push({
    area: 'payment',
    check: 'unauthenticated payment status update blocked',
    status: unauthPayment.status,
    pass: unauthPayment.status === 401 || unauthPayment.status === 403,
    detail: unauthPayment.data?.message,
  });

  const orderStatusFlow = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
  for (const st of orderStatusFlow) {
    const upd = await req('PATCH', `/orders/${orderId}/item-status`, {
      id: orderItemId,
      status: st,
      note: `QA regression ${st}`,
    }, seller1Token);

    report.checks.push({
      area: 'order',
      check: `item status ${st}`,
      status: upd.status,
      pass: upd.status === 200,
      detail: upd.data?.message || upd.data?.overallStatus || null,
    });
  }

  const shippingCreate = await req('POST', `/shipping/create/${orderId}`, {}, seller1Token);
  const shippingId = shippingCreate.data?.data?._id;

  report.checks.push({
    area: 'shipping',
    check: 'create shipping',
    status: shippingCreate.status,
    pass: shippingCreate.status === 200,
    detail: shippingCreate.data?.data?.status,
  });

  const shipFlow = ['pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  for (const st of shipFlow) {
    const upd = await req('PATCH', `/shipping/${shippingId}/status`, {
      status: st,
      note: `QA regression ${st}`,
    }, seller1Token);

    report.checks.push({
      area: 'shipping',
      check: `shipping status ${st}`,
      status: upd.status,
      pass: upd.status === 200,
      detail: upd.data?.status || upd.data?.message || null,
    });
  }

  const shippingDetails = await req('GET', `/shipping/${shippingId}`, null, seller1Token);
  report.checks.push({
    area: 'shipping',
    check: 'shipping details fetch',
    status: shippingDetails.status,
    pass: shippingDetails.status === 200,
    detail: shippingDetails.data?.data?.status,
  });

  const refundCreate = await req('POST', '/refunds', {
    orderId,
    orderItemId,
    amount: createOrderValid.data?.order?.totalAmount || 1,
    reason: 'QA regression refund check',
    refundType: 'return',
  }, customerToken);

  const refundId = refundCreate.data?.data?._id;
  report.checks.push({
    area: 'refund',
    check: 'create refund request',
    status: refundCreate.status,
    pass: refundCreate.status === 200,
    detail: refundCreate.data?.data?.requestNumber || refundCreate.data?.message,
  });

  const refundApprove = await req('PUT', `/refunds/${refundId}/approve`, {
    status: 'approved',
    comments: 'QA regression approve',
  }, seller1Token);

  report.checks.push({
    area: 'refund',
    check: 'approve refund',
    status: refundApprove.status,
    pass: refundApprove.status === 200,
    detail: refundApprove.data?.data?.status || refundApprove.data?.message,
  });

  const refundReturn = await req('PATCH', `/refunds/${refundId}/return-status`, {
    status: 'received',
  }, seller1Token);

  report.checks.push({
    area: 'refund',
    check: 'set return status received',
    status: refundReturn.status,
    pass: refundReturn.status === 200,
    detail: refundReturn.data?.message || refundReturn.data?.data?.status,
  });

  const summary = {
    total: report.checks.length,
    passed: report.checks.filter((c) => c.pass).length,
    failed: report.checks.filter((c) => !c.pass).length,
  };

  console.log(JSON.stringify({ summary, report }, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
})();
