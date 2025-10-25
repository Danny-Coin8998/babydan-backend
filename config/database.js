const mysql = require('mysql2');

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'u532561418_babydan_user',
    password: process.env.DB_PASSWORD || 'baby418Dan',
    database: process.env.DB_NAME || 'u532561418_babydandb',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Helper function to get connection
const getConnection = () => {
    return pool.promise();
};

// Test database connection
const testConnection = async () => {
    try {
        const connection = await getConnection();
        await connection.execute('SELECT 1');
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

module.exports = {
    pool,
    getConnection,
    testConnection
};
