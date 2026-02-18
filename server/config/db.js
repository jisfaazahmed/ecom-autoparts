// ============================================
// In-Memory Database - AutoMatrix Notification Service
// ============================================
// Temporary development layer — only this file changes for PostgreSQL migration.
// NO deviceTokens collection.

const db = {
  notifications: [],
  notificationQueue: [],
  // NO deviceTokens collection — web app doesn't need push
};

/**
 * Get the in-memory database instance.
 * @returns {object} The database object
 */
export const getDb = () => db;

/**
 * Clear all data (useful for testing).
 */
export const clearDb = () => {
  db.notifications.length = 0;
  db.notificationQueue.length = 0;
};

export default db;
