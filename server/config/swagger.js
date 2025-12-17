const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auto Parts Marketplace API',
      version: '1.0.0',
      description: 'Complete API Documentation for the Team',
    },
    servers: [{ url: 'http://localhost:5000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    paths: {
      // ===========================
      // 1. AUTHENTICATION
      // ===========================
      '/api/auth/register': {
        post: {
          summary: 'Register a new user',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                password: { type: 'string' },
                role: { type: 'string', enum: ['CUSTOMER', 'ADMIN'] },
                shopName: { type: 'string' }
              }
            }}}
          },
          responses: {
            201: { description: 'Registration successful' },
            400: { description: 'User already exists' }
          }
        }
      },
      '/api/auth/login': {
        post: {
          summary: 'Login to get a token',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string' },
                password: { type: 'string' }
              }
            }}}
          },
          responses: {
            200: { description: 'Login successful (Returns Token)' },
            403: { description: 'Account pending' }
          }
        }
      },

      // ===========================
      // 2. VEHICLE DATABASE
      // ===========================
      '/api/vehicles/years': {
        get: {
          summary: 'Get list of available years',
          tags: ['Vehicles'],
          responses: { 200: { description: 'List of years' } }
        }
      },
      '/api/vehicles/makes': {
        get: {
          summary: 'Get makes for a specific year',
          tags: ['Vehicles'],
          parameters: [{ in: 'query', name: 'year', schema: { type: 'integer' }, required: true }],
          responses: { 200: { description: 'List of makes' } }
        }
      },
      '/api/vehicles/models': {
        get: {
          summary: 'Get models for a specific Year + Make',
          tags: ['Vehicles'],
          parameters: [
            { in: 'query', name: 'year', schema: { type: 'integer' }, required: true },
            { in: 'query', name: 'make', schema: { type: 'string' }, required: true }
          ],
          responses: { 200: { description: 'List of models' } }
        }
      },
      '/api/vehicles': {
        post: {
          summary: 'Add a new vehicle (Super Admin Only)',
          tags: ['Vehicles'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['year', 'make', 'model'],
              properties: {
                year: { type: 'integer' },
                make: { type: 'string' },
                model: { type: 'string' },
                submodel: { type: 'string' },
                engine: { type: 'string' }
              }
            }}}
          },
          responses: { 201: { description: 'Vehicle created' } }
        }
      },

      // ===========================
      // 3. CATEGORIES
      // ===========================
      '/api/categories': {
        get: {
          summary: 'Get all categories',
          tags: ['Categories'],
          responses: { 200: { description: 'List of categories' } }
        },
        post: {
          summary: 'Create a category (Super Admin Only)',
          tags: ['Categories'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                parentId: { type: 'string', description: 'Optional Parent Category ID' }
              }
            }}}
          },
          responses: { 201: { description: 'Category created' } }
        }
      },

      // ===========================
      // 4. MASTER PRODUCTS
      // ===========================
      '/api/products': {
        get: {
          summary: 'Search products by Vehicle and Category',
          tags: ['Products'],
          parameters: [
            { in: 'query', name: 'vehicleId', schema: { type: 'string' } },
            { in: 'query', name: 'categoryId', schema: { type: 'string' } }
          ],
          responses: { 200: { description: 'List of matching products' } }
        },
        post: {
          summary: 'Create a Master Product (Super Admin Only)',
          tags: ['Products'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['name', 'partNumber', 'categoryId', 'vehicleIds'],
              properties: {
                name: { type: 'string' },
                partNumber: { type: 'string' },
                categoryId: { type: 'string' },
                vehicleIds: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' }
              }
            }}}
          },
          responses: { 201: { description: 'Product created' } }
        }
      },

      // ===========================
      // 5. VENDOR OFFERS
      // ===========================
      '/api/offers/{productId}': {
        get: {
          summary: 'Get all prices/vendors for a specific product',
          tags: ['Offers'],
          parameters: [{ in: 'path', name: 'productId', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'List of offers from different vendors' } }
        }
      },
      '/api/offers': {
        post: {
          summary: 'Vendor adds their price (Vendor Only)',
          tags: ['Offers'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['productId', 'price', 'stock'],
              properties: {
                productId: { type: 'string' },
                price: { type: 'number' },
                stock: { type: 'integer' },
                condition: { type: 'string', enum: ['New', 'Used'] }
              }
            }}}
          },
          responses: { 201: { description: 'Offer listed' } }
        }
      }
    }
  },
  apis: [], 
};

const specs = swaggerJsdoc(options);
module.exports = specs;