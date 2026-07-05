const express = require('express');
const router = express.Router();
const { sendMessage, getChats, getChatById, deleteChat } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/send',        protect, sendMessage);
router.get('/',             protect, getChats);
router.get('/:id',          protect, getChatById);
router.delete('/:id',       protect, deleteChat);

module.exports = router;
