const theme = {
    primary: '#2563EB',
    secondary: '#1E3A8A',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#F3F4F6',
    card: '#FFFFFF',
    text: '#1F2937',
    textLight: '#6B7280',
    border: '#E5E7EB',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
};

const EmailBuilder = {
    theme,

    formatCurrency(amount) {
        if (amount === undefined || amount === null) return 'Rs. 0';
        return `Rs. ${parseFloat(amount).toFixed(2)}`;
    },

    buildLayout(content, preheader = 'Update from AutoMatrix') {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoMatrix</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${theme.background}; font-family: ${theme.fontFamily}; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
        @media screen and (max-width: 600px) {
            .container { width: 100% !important; max-width: 100% !important; }
            .mobile-padding { padding-left: 15px !important; padding-right: 15px !important; }
            .stack-column { display: block !important; width: 100% !important; }
            .text-center-mobile { text-align: center !important; }
        }
    </style>
</head>
<body style="background-color: ${theme.background}; margin: 0; padding: 0;">
    <!-- Preheader -->
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: ${theme.fontFamily}; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${preheader}
    </div>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${theme.background};">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: ${theme.card}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    ${content}
                    ${this.buildFooter()}
                </table>
                <table border="0" cellpadding="0" cellspacing="0" width="600" class="container">
                    <tr>
                        <td align="center" style="padding: 20px; font-family: ${theme.fontFamily}; font-size: 12px; color: ${theme.textLight}; line-height: 1.5;">
                            This is an automatically generated email. Please do not reply directly to this email.<br>
                            &copy; ${new Date().getFullYear()} AutoMatrix. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    },

    buildHeader() {
        return `
        <tr>
            <td align="center" style="padding: 30px 20px; background-color: ${theme.secondary};">
                <h1 style="margin: 0; color: #FFFFFF; font-family: ${theme.fontFamily}; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">AutoMatrix</h1>
                <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-family: ${theme.fontFamily}; font-size: 14px;">Your Premium Auto Parts Hub</p>
            </td>
        </tr>
        `;
    },

    buildStatusBanner(title, message, color = theme.primary, icon = '') {
        return `
        <tr>
            <td align="center" style="padding: 30px 20px 20px 20px; border-bottom: 1px solid ${theme.border};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="center" style="font-family: ${theme.fontFamily};">
                            ${icon ? `<div style="font-size: 40px; margin-bottom: 15px;">${icon}</div>` : ''}
                            <h2 style="margin: 0 0 10px 0; color: ${color}; font-size: 24px; font-weight: 600;">${title}</h2>
                            <p style="margin: 0; color: ${theme.textLight}; font-size: 16px; line-height: 1.5;">${message}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        `;
    },

    buildGreeting(name) {
        return `
        <tr>
            <td align="left" style="padding: 30px 30px 15px 30px; font-family: ${theme.fontFamily};">
                <p style="margin: 0; color: ${theme.text}; font-size: 16px; font-weight: 600;">Hi ${name || 'Customer'},</p>
            </td>
        </tr>
        `;
    },

    buildMessage(message) {
        return `
        <tr>
            <td align="left" style="padding: 0 30px 20px 30px; font-family: ${theme.fontFamily};">
                <p style="margin: 0; color: ${theme.text}; font-size: 15px; line-height: 1.6;">${message}</p>
            </td>
        </tr>
        `;
    },

    buildOrderSummary(data) {
        const rows = Object.entries(data).filter(([_, val]) => val).map(([key, val]) => `
            <tr>
                <td width="40%" style="padding: 8px 0; color: ${theme.textLight}; font-size: 14px; font-weight: 500;">${key}</td>
                <td width="60%" style="padding: 8px 0; color: ${theme.text}; font-size: 14px; font-weight: 600; text-align: right;">${val}</td>
            </tr>
        `).join('');

        return `
        <tr>
            <td align="center" style="padding: 0 30px 20px 30px; font-family: ${theme.fontFamily};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 6px; padding: 15px;">
                    <tr><td style="padding: 15px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            ${rows}
                        </table>
                    </td></tr>
                </table>
            </td>
        </tr>
        `;
    },

    buildOrderItems(items, title = 'Order Items') {
        if (!items || !items.length) return '';
        
        let itemsHtml = `
        <tr>
            <td align="left" style="padding: 10px 30px 5px 30px; font-family: ${theme.fontFamily};">
                <h3 style="margin: 0 0 10px 0; color: ${theme.text}; font-size: 16px; font-weight: 600;">${title}</h3>
            </td>
        </tr>
        <tr>
            <td align="center" style="padding: 0 30px 20px 30px; font-family: ${theme.fontFamily};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
        `;

        // Group by vendor
        const groupedItems = items.reduce((acc, item) => {
            const vendor = item.vendorName || item.product?.vendor?.shopName || 'Sold by AutoMatrix';
            if (!acc[vendor]) acc[vendor] = [];
            acc[vendor].push(item);
            return acc;
        }, {});

        for (const [vendor, vendorItems] of Object.entries(groupedItems)) {
            itemsHtml += `
                    <tr>
                        <td colspan="2" style="padding: 15px 0 10px 0; border-bottom: 1px solid ${theme.border};">
                            <span style="background-color: ${theme.background}; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; color: ${theme.textLight}; text-transform: uppercase; letter-spacing: 0.5px;">Parcel from: ${vendor}</span>
                        </td>
                    </tr>
            `;
            vendorItems.forEach(item => {
                const productName = item.productName || item.product?.name || 'Product';
                const quantity = item.quantity || 1;
                const price = this.formatCurrency(item.price || item.product?.price || 0);
                const image = item.image || item.product?.images?.[0] || 'https://via.placeholder.com/100x100?text=Image';
                
                itemsHtml += `
                    <tr>
                        <td width="70%" style="padding: 15px 0; border-bottom: 1px dashed ${theme.border};">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td width="60" style="padding-right: 15px;">
                                        <img src="${image}" alt="${productName}" width="60" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid ${theme.border}; display: block;">
                                    </td>
                                    <td style="font-family: ${theme.fontFamily};">
                                        <p style="margin: 0; color: ${theme.text}; font-size: 14px; font-weight: 600; line-height: 1.4;">${productName}</p>
                                        <p style="margin: 4px 0 0 0; color: ${theme.textLight}; font-size: 13px;">Qty: ${quantity}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                        <td width="30%" align="right" valign="top" style="padding: 15px 0; border-bottom: 1px dashed ${theme.border}; font-family: ${theme.fontFamily};">
                            <p style="margin: 0; color: ${theme.text}; font-size: 14px; font-weight: 600;">${price}</p>
                        </td>
                    </tr>
                `;
            });
        }

        itemsHtml += `
                </table>
            </td>
        </tr>
        `;
        return itemsHtml;
    },

    buildFinancialSummary(totals) {
        if (!totals) return '';
        
        const formatRow = (label, value, isTotal = false) => {
            if (value === undefined || value === null) return '';
            const valStr = typeof value === 'number' ? this.formatCurrency(value) : value;
            return `
            <tr>
                <td style="padding: 8px 0; color: ${isTotal ? theme.text : theme.textLight}; font-size: ${isTotal ? '16px' : '14px'}; font-weight: ${isTotal ? '700' : '500'};">${label}</td>
                <td align="right" style="padding: 8px 0; color: ${isTotal ? theme.primary : theme.text}; font-size: ${isTotal ? '16px' : '14px'}; font-weight: ${isTotal ? '700' : '600'};">${valStr}</td>
            </tr>
            `;
        };

        return `
        <tr>
            <td align="center" style="padding: 0 30px 20px 30px; font-family: ${theme.fontFamily};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td width="50%"></td>
                        <td width="50%">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                ${formatRow('Subtotal', totals.subtotal)}
                                ${formatRow('Shipping', totals.shipping)}
                                ${formatRow('Tax', totals.tax)}
                                ${formatRow('Discount', totals.discount ? `-${this.formatCurrency(totals.discount)}` : null)}
                                <tr>
                                    <td colspan="2" style="padding: 10px 0;"><div style="border-top: 1px solid ${theme.border};"></div></td>
                                </tr>
                                ${formatRow('Grand Total', totals.total, true)}
                                ${formatRow('Refund Amount', totals.refundAmount, true)}
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        `;
    },

    buildDeliveryAndPayment(shipping, payment) {
        let content = '';
        
        if (shipping) {
            let addressHtml = '';
            if (shipping.address) {
                addressHtml = `
                    <p style="margin: 0; color: ${theme.textLight}; font-size: 13px; line-height: 1.5;">
                        ${shipping.address.fullName || ''}<br>
                        ${shipping.address.addressLine1 || ''}<br>
                        ${shipping.address.addressLine2 ? shipping.address.addressLine2 + '<br>' : ''}
                        ${shipping.address.city || ''}, ${shipping.address.state || ''} ${shipping.address.postalCode || ''}
                    </p>
                `;
            }

            content += `
                <td width="50%" valign="top" style="padding-right: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: ${theme.text}; font-size: 14px; font-weight: 600;">Delivery Information</h4>
                    <p style="margin: 0 0 8px 0; color: ${theme.text}; font-size: 13px; font-weight: 500;">${shipping.method || 'Standard Shipping'}</p>
                    ${addressHtml}
                </td>
            `;
        }
        
        if (payment) {
            content += `
                <td width="50%" valign="top" style="padding-left: ${shipping ? '15px' : '0'}; border-left: ${shipping ? `1px solid ${theme.border}` : 'none'};">
                    <h4 style="margin: 0 0 10px 0; color: ${theme.text}; font-size: 14px; font-weight: 600;">Payment Information</h4>
                    <p style="margin: 0 0 5px 0; color: ${theme.text}; font-size: 13px; font-weight: 500;">${payment.method || 'Credit Card'}</p>
                    <p style="margin: 0; color: ${theme.textLight}; font-size: 13px;">Status: <span style="font-weight: 600; color: ${payment.status === 'Paid' ? theme.success : theme.warning};">${payment.status || 'Pending'}</span></p>
                </td>
            `;
        }

        if (!content) return '';

        return `
        <tr>
            <td align="center" style="padding: 10px 30px 25px 30px; font-family: ${theme.fontFamily};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${theme.background}; border-radius: 6px; padding: 20px;">
                    <tr><td style="padding: 20px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                ${content}
                            </tr>
                        </table>
                    </td></tr>
                </table>
            </td>
        </tr>
        `;
    },

    buildNextSteps(steps) {
        if (!steps || !steps.length) return '';
        
        const stepsHtml = steps.map(step => `
            <tr>
                <td width="20" valign="top" style="padding: 0 0 10px 0; color: ${theme.primary}; font-size: 16px;">•</td>
                <td style="padding: 0 0 10px 0; color: ${theme.text}; font-size: 14px; line-height: 1.5;">${step}</td>
            </tr>
        `).join('');

        return `
        <tr>
            <td align="left" style="padding: 0 30px 25px 30px; font-family: ${theme.fontFamily};">
                <h4 style="margin: 0 0 15px 0; color: ${theme.text}; font-size: 16px; font-weight: 600;">What happens next?</h4>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    ${stepsHtml}
                </table>
            </td>
        </tr>
        `;
    },

    buildButton(text, url) {
        return `
        <tr>
            <td align="center" style="padding: 10px 30px 30px 30px; font-family: ${theme.fontFamily};">
                <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center" bgcolor="${theme.primary}" style="border-radius: 6px;">
                            <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 30px; font-family: ${theme.fontFamily}; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 6px; border: 1px solid ${theme.primary};">
                                ${text}
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        `;
    },

    buildSupportSection() {
        return `
        <tr>
            <td align="center" style="padding: 30px; border-top: 1px solid ${theme.border}; font-family: ${theme.fontFamily};">
                <h4 style="margin: 0 0 10px 0; color: ${theme.text}; font-size: 16px; font-weight: 600;">Need Help?</h4>
                <p style="margin: 0 0 15px 0; color: ${theme.textLight}; font-size: 14px; line-height: 1.5;">We're here for you. Visit our Help Center or contact our support team.</p>
                <a href="${process.env.FRONTEND_URL}/support" style="color: ${theme.primary}; font-size: 14px; font-weight: 600; text-decoration: none;">Visit Help Center &rarr;</a>
            </td>
        </tr>
        `;
    },

    buildFooter() {
        return `
        <tr>
            <td align="center" style="padding: 30px 20px; background-color: ${theme.background}; border-top: 1px solid ${theme.border};">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="center" style="font-family: ${theme.fontFamily}; font-size: 13px; color: ${theme.textLight}; line-height: 1.6;">
                            <p style="margin: 0 0 15px 0; font-weight: 600; color: ${theme.text};">AutoMatrix</p>
                            <p style="margin: 0 0 15px 0;">
                                <a href="${process.env.FRONTEND_URL}/terms" style="color: ${theme.textLight}; text-decoration: underline; margin: 0 10px;">Terms</a>
                                <a href="${process.env.FRONTEND_URL}/privacy" style="color: ${theme.textLight}; text-decoration: underline; margin: 0 10px;">Privacy Policy</a>
                                <a href="${process.env.FRONTEND_URL}/contact" style="color: ${theme.textLight}; text-decoration: underline; margin: 0 10px;">Contact Us</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        `;
    }
};

module.exports = EmailBuilder;
