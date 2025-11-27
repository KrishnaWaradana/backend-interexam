// apps/backend/src/config/prismaClient.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma; // Export instance prisma secara langsung