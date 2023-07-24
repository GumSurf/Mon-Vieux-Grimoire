const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const upload = require('../middleware/multer-config');

const bookCtrl = require('../controllers/book');
const uploadImageMiddleware = require('../middleware/uploadImage');

router.get('/', bookCtrl.getAllBook);
router.get('/bestrating', bookCtrl.bestRating);
router.delete('/:id', auth, bookCtrl.deleteBook);
router.get('/:id', bookCtrl.getOneBook);

// Utilisez le middleware de Multer ici
router.post('/', auth, upload.single('image'), uploadImageMiddleware, bookCtrl.createBook);

router.put('/:id', auth, upload.single('image'), uploadImageMiddleware, bookCtrl.modifyBook);
router.post('/:id/rating', auth, bookCtrl.rating);

module.exports = router;
