require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wildlife',
  jwtSecret: process.env.JWT_SECRET || 'change-me'
};
