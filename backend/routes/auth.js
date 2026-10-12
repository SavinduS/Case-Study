const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const { register, registerVillager, login, me } = require('../controllers/authController');

router.post('/register', register);
// Public sign-up from the mobile app: always creates a villager.
router.post('/register/villager', registerVillager);
router.post('/login', login);
// Session restore for the mobile app (token kept between launches)
router.get('/me', auth, me);

module.exports = router;