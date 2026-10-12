const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const { register, login, me } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
// Session restore for the mobile app (token kept between launches)
router.get('/me', auth, me);

module.exports = router;