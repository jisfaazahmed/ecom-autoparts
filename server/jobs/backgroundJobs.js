/**
 * Background Jobs for E-commerce Platform
 * Handles periodic tasks like releasing expired reservations
 */

const InventoryReservationService = require('../services/inventoryReservation.service');

class BackgroundJobs {
    /**
     * Initialize background jobs
     */
    static initializeJobs() {
        console.log('🔄 Initializing background jobs...');

        // Release expired reservations every 5 minutes
        this.startReleaseExpiredReservations();
    }

    /**
     * Release expired inventory reservations
     * Run every 5 minutes to clean up old reservations
     */
    static startReleaseExpiredReservations() {
        const intervalMs = 5 * 60 * 1000; // 5 minutes

        console.log(`✓ Scheduled inventory cleanup job every ${intervalMs / 60000} minutes`);

        // Run once immediately if needed
        // InventoryReservationService.releaseExpiredReservations().catch(err => 
        //     console.error('Error in background job:', err)
        // );

        // Run periodically
        setInterval(async () => {
            try {
                await InventoryReservationService.releaseExpiredReservations();
            } catch (error) {
                console.error('❌ Error in background inventory cleanup job:', error.message);
            }
        }, intervalMs);
    }
}

module.exports = BackgroundJobs;
