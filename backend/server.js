const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');

connectDB().catch(console.error);
app.listen(config.port, () => console.log(`API on :${config.port}`));
