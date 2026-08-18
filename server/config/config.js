module.exports = {
    MONGO_IP: process.env.MONGO_IP || 'localhost',
    MONGO_PORT: process.env.MONGO_PORT || 27017,
    MONGO_USER: process.env.MONGO_USER || 'root',
    MONGO_PASSWORD: process.env.MONGO_PASSWORD || 'password',
    MONGO_DB: process.env.MONGO_DB || 'ecom-autoparts',
    SESSION_SECRET: process.env.SESSION_SECRET || 'secret',
};