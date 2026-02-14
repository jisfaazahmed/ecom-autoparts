const Shipping = require('../models/shipping.model');
const Order = require('../models/order.model');
const OrderTimeline = require('../models/timeline.model');

class ShippingService {

    static ZONES = {
        'zone1': {
            districts: ['colombo'],
        },
        'zone2': {
            districts: ['gampaha', 'kaluthara'],
        },
        'zone3': {
            districts: ['kurunegala',
                'Kandy',
                'Matale',
                'Nuwara Eliya',
                'Galle',
                'Matara',
                'Hambantota',
                'Puttalam',
                'Anuradhapura',
                'Polonnaruwa',
                'Badulla',
                'Monaragala',
                'Ratnapura',
                'Kegalle',
                'Trincomalee',
                'Batticaloa',
                'Ampara',
                'Jaffna',
                'Vavuniya',
                'Mannar',
                'Kilinochchi',
                'Mullaitivu'],

        }
    };


    async calculateShippingCost(orderData) {
        const {
            items,
            deliveryAddress,
            shippingMethod = 'standard',
        } = orderData;

        const totalWeight = items.reduce((sum, item) => {
            const weight = item.product.weight || 0.5;
            return sum + (weight * item.quantity);
        }, 0);

        const zone = await this.getShippingZone(deliveryAddress.district, deliveryAddress.city);

        if (!zone) {
            throw new Error('Delivery not available to this location');
        }

        const rateConfig = zone.rates[shippingMethod];

        if (!rateConfig) {
            throw new Error(`${shippingMethod} delivery not available for this zone`);
        }

        const baseCharge = rateConfig.baseRate;
        const weightCharge = totalWeight > 1 ? (totalWeight - 1) * rateConfig.perKgRate : 0;

        const zoneCharge = this.getZoneCharge(zone.zoneType, shippingMethod);
        const totalCharge = baseCharge + weightCharge + zoneCharge;

        const orderTotal = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const freeShippingThreshold = rateConfig.freeShippingThreshold || 0;

        return {
            baseCharge,
            weightCharge,
            zoneCharge,
            totalCharge: orderTotal >= freeShippingThreshold ? 0 : totalCharge,
            freeShipping: orderTotal >= freeShippingThreshold,
            weight: totalWeight,
            zone: zone.zoneName,
            estimatedDays: zone.estimatedDelivery[shippingMethod]
        };

    }

    async getShippingZone(district) {
        let zone = await this.ShippingZone.findOne({
            'district.name': district,
            isActive: true
        });

        if (!zone) {
            // Fallback to zone type matching
            for (const [zoneType, data] of Object.entries(this.constructor.ZONES)) {
                if (data.districts.includes(district)) {
                    zone = await ShippingZone.findOne({ zoneType, isActive: true });
                    break;
                }
            }
        }
        return zone;
    }

    getZoneCharge(zoneType, shippingMethod) {
        const zoneCharges = {
            'zone1': { standard: 100, express: 300, same_day: 500 },
            'zone2': { standard: 200, express: 400, same_day: 0 },
            'zone3': { standard: 300, express: 500, same_day: 0 },
        };

        return zoneCharges[zoneType]?.[shippingMethod] || 0;
    }

    async createShipping(orderId, vendorId) {
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user');

        if (!order) {
            throw new Error('Order not found');
        }

        // Get vendor items
        const vendorItems = order.items.filter(
            item => item.vendor.toString() === vendorId.toString()
        );

        if (vendorItems.length === 0) {
            throw new Error('No items for this vendor');
        }

        const totalWeight = vendorItems.reduce((sum, item) => {
            const weight = item.product?.weight || 0.5;
            return sum + (weight * item.quantity);
        }, 0);

        const packageType = totalWeight < 2 ? 'small_box' :
            totalWeight < 5 ? 'medium_box' : 'large_box';

        const courierPartner = await this.assignCourier(order.shippingAddress.district, order.shippingMethod);

        const estimatedDeliveryDate = await this.calculateDeliveryDate(
            order.shippingAddress.district,
            order.shippingMethod
        );

        // Create shipping record
        const shipping = new Shipping({
            order: orderId,
            vendor: vendorId,
            customer: order.user._id,
            shippingMethod: order.shippingMethod,
            courierPartner,
            deliveryAddress: {
                customerName: order.shippingAddress.fullName,
                phone: order.shippingAddress.phone,
                alternatePhone: order.shippingAddress.alternatePhone,
                addressLine1: order.shippingAddress.addressLine1,
                addressLine2: order.shippingAddress.addressLine2,
                district: this.getDistrict(order.shippingAddress.city),
                postalCode: order.shippingAddress.postalCode,
                addressType: order.shippingAddress.addressType
            },
            packageDetails: {
                weight: totalWeight,
                packageType,
                valueDeclaration: vendorItems.reduce((sum, item) => sum + item.finalPrice, 0)
            },
            charges: {
                baseCharge: order.shippingCharges,
                totalCharge: order.shippingCharges,
                paidBy: 'customer'
            },
            estimatedDeliveryDate,
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                timestamp: new Date(),
                note: 'Shipping created, awaiting pickup'
            }]
        });

        await shipping.save();

        await OrderTimeline.create({
            order: orderId,
            event: 'shipping_created',
            title: 'Shipping Label Created',
            description: `Shipping created via ${courierPartner}`,
            actorType: 'system',
            metadata: { trackingNumber: shipping.trackingNumber }
        });

        return shipping;
    }

    async assignCourier(district, shippingMethod) {

        const zone = await ShippingZone.findOne({
            'districts.name': district,
            isActive: true
        });

        if (!zone || !zone.availableCouriers || zone.availableCouriers.length === 0) {
            return 'pronto';
        }

        const availableCouriers = zone.availableCouriers
            .filter(c => c.available)
            .sort((a, b) => a.priority - b.priority);

        // Special handling for same-day delivery
        if (shippingMethod === 'same_day') {
            const sameDayCouriers = ['uber', 'pickme_flash'];
            const courier = availableCouriers.find(c => sameDayCouriers.includes(c.courier));
            return courier?.courier || 'pickme_flash';
        }

        return availableCouriers[0]?.courier || 'pronto';
    }

    async calculateDeliveryDate(district, shippingMethod) {

        const zone = await this.getShippingZone(district);
        if (!zone) {
            const defaultDays = {
                'standard': 5,
                'express': 2,
                'same_day': 0
            };

            const days = defaultDays[shippingMethod] || 5;
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + days);
            return deliveryDate;
        }

        const estimatedDays = zone.estimatedDelivery[shippingMethod];
        const deliveryDate = new Date();

        if (shippingMethod === 'same_day') {
            return deliveryDate;
        }

        const maxDays = estimatedDays?.max || 5;
        deliveryDate.setDate(deliveryDate.getDate() + maxDays);

        return deliveryDate;
    }

    async schedulePickup(shippingId, pickupData) {

        const shipping = await Shipping.findById(shippingId);
        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.pickupAddress = pickupData.pickupAddress;
        shipping.estimatedPickupDate = pickupData.pickupDate;
        shipping.status = 'pickup_scheduled';

        shipping.statusHistory.push({
            status: 'pickup_scheduled',
            timestamp: new Date(),
            note: `Pickup scheduled for ${pickupData.pickupDate.toLocaleDateString()}`,
            location: {
                district: pickupData.pickupAddress.district
            }
        });

        await shipping.save();

        return shipping;
    }

    async updateStatus(shippingId, statusData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        const { status, location, note, updatedBy, scanType } = statusData;

        if (!this.isValidStatusTransition(shipping.status, status)) {
            throw new Error(`Invalid status transition from ${shipping.status} to ${status}`);
        }

        shipping.status = status;

        if (location) {
            shipping.currentLocation = {
                ...location,
                lastUpdated: new Date()
            };
        }

        shipping.statusHistory.push({
            status,
            location,
            timestamp: new Date(),
            note,
            updatedBy,
            scanType
        });

        // Update specific dates
        switch (status) {
            case 'picked_up':
                shipping.actualPickupDate = new Date();
                break;
            case 'delivered':
                shipping.actualDeliveryDate = new Date();
                break;
        }

        await shipping.save();

        await OrderTimeline.create({
            order: shipping.order,
            event: this.mapStatusToEvent(status),
            title: this.getStatusTitle(status),
            description: note || `Shipment ${status}`,
            actorType: 'courier',
            location: location
        });

        return shipping;
    }

    //statsus of shipping
    isValidStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'pending': ['pickup_scheduled', 'cancelled'],
            'pickup_scheduled': ['picked_up', 'cancelled'],
            'picked_up': ['in_transit', 'cancelled'],
            'in_transit': ['reached_hub', 'out_for_delivery'],
            'reached_hub': ['in_transit', 'out_for_delivery'],
            'out_for_delivery': ['delivered', 'failed_delivery'],
            'failed_delivery': ['out_for_delivery', 'returned_to_vendor'],
            'delivered': [],
            'returned_to_vendor': [],
            'cancelled': []
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    }

    mapStatusToEvent(status) {
        const mapping = {
            'pickup_scheduled': 'pickup_scheduled',
            'picked_up': 'picked_up',
            'in_transit': 'in_transit',
            'reached_hub': 'reached_hub',
            'out_for_delivery': 'out_for_delivery',
            'delivered': 'delivered',
            'failed_delivery': 'delivery_failed',
            'returned_to_vendor': 'return_received'
        };
        return mapping[status] || status;
    }

    getStatusTitle(status) {
        const titles = {
            'pickup_scheduled': 'Pickup Scheduled',
            'picked_up': 'Package Picked Up',
            'in_transit': 'In Transit',
            'reached_hub': 'Reached Sorting Hub',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'failed_delivery': 'Delivery Failed',
            'returned_to_vendor': 'Returned to Vendor'
        };
        return titles[status] || status;
    }


    async recordDeliveryAttempt(shippingId, attemptData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        const attemptNumber = shipping.deliveryAttempts.length + 1;

        shipping.deliveryAttempts.push({
            attemptNumber,
            attemptDate: new Date(),
            status: attemptData.status,
            reason: attemptData.reason,
            nextAttemptDate: attemptData.nextAttemptDate,
            deliveryAgentNotes: attemptData.notes,
            customerContact: attemptData.customerContact,
            photo: attemptData.photo
        });

        if (attemptData.status === 'delivered') {
            shipping.status = 'delivered';
            shipping.actualDeliveryDate = new Date();
        } else if (attemptNumber >= 3 && attemptData.status === 'failed') {
            shipping.status = 'returned_to_vendor';
        } else {
            shipping.status = 'failed_delivery';
        }

        await shipping.save();

        return shipping;
    }

    async confirmDelivery(shippingId, deliveryData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.proofOfDelivery = {
            signature: deliveryData.signature,
            photo: deliveryData.photo,
            recipientName: deliveryData.recipientName,
            recipientNIC: deliveryData.recipientNIC,
            recipientRelation: deliveryData.recipientRelation,
            deliveryNotes: deliveryData.notes,
            timestamp: new Date(),
            location: deliveryData.location
        };

        shipping.deliveryAgent = deliveryData.deliveryAgent;
        shipping.status = 'delivered';
        shipping.actualDeliveryDate = new Date();

        shipping.statusHistory.push({
            status: 'delivered',
            timestamp: new Date(),
            note: `Delivered to ${deliveryData.recipientName}`,
            updatedBy: deliveryData.deliveryAgent.name,
            location: {
                city: shipping.deliveryAddress.city,
                coordinates: deliveryData.location
            }
        });

        await shipping.save();

        // Update order status
        const order = await Order.findById(shipping.order);
        const allItemsDelivered = order.items.every(item => {
            return true;
        });

        if (allItemsDelivered) {
            order.overallStatus = 'delivered';
            await order.save();
        }

        await OrderTimeline.create({
            order: shipping.order,
            event: 'delivered',
            title: 'Order Delivered',
            description: `Package delivered to ${deliveryData.recipientName}`,
            actorType: 'courier',
            metadata: {
                recipientName: deliveryData.recipientName,
                deliveryAgent: deliveryData.deliveryAgent.name
            }
        });

        return shipping;
    }

    async trackShipment(trackingNumber) {

        const shipping = await Shipping.findOne({ trackingNumber })
            .populate('order', 'orderNumber')
            .populate('customer', 'name phone');

        if (!shipping) {
            throw new Error('Tracking number not found');
        }

        return {
            trackingNumber: shipping.trackingNumber,
            status: shipping.status,
            estimatedDelivery: shipping.estimatedDeliveryDate,
            currentLocation: shipping.currentLocation,
            statusHistory: shipping.statusHistory,
            deliveryAddress: shipping.deliveryAddress,
            deliveryAgent: shipping.deliveryAgent,
            deliveryAttempts: shipping.deliveryAttempts,
            proofOfDelivery: shipping.proofOfDelivery
        };
    }

    async reportIssue(shippingId, issueData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        shipping.issues.push({
            type: issueData.type,
            severity: issueData.severity,
            description: issueData.description,
            reportedBy: issueData.reportedBy,
            reportedAt: new Date(),
            photos: issueData.photos || []
        });

        if (issueData.severity === 'critical') {
            shipping.status = 'on_hold';
        }

        await shipping.save();

        return shipping;
    }

    async submitRating(shippingId, ratingData) {
        const shipping = await Shipping.findById(shippingId);

        if (!shipping) {
            throw new Error('Shipping not found');
        }

        if (shipping.status !== 'delivered') {
            throw new Error('Can only rate delivered shipments');
        }

        const overall = Math.round(
            (ratingData.deliverySpeed + ratingData.courierBehavior + ratingData.packaging) / 3
        );

        shipping.rating = {
            deliverySpeed: ratingData.deliverySpeed,
            courierBehavior: ratingData.courierBehavior,
            packaging: ratingData.packaging,
            overall,
            feedback: ratingData.feedback,
            ratedAt: new Date()
        };

        await shipping.save();

        return shipping;
    }
}
module.exports = new ShippingService();