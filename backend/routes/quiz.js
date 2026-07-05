const express = require('express');
const router = express.Router();
const { generateQuiz, submitQuiz, resetQuizAttempt, getQuizzes, getQuizById } = require('../controllers/quizController');
const { protect } = require('../middleware/auth');

router.post('/generate',    protect, generateQuiz);
router.post('/:id/submit',  protect, submitQuiz);
router.post('/:id/reset',   protect, resetQuizAttempt);
router.get('/',             protect, getQuizzes);
router.get('/:id',          protect, getQuizById);

module.exports = router;
