const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/notesController');
const { protect } = require('../middleware/auth');

const router = express.Router();

function multerNotesUpload(req, res, next) {
  ctrl.upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ success: false, message: 'File too large (max 15MB).' });
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: err.message || 'Upload failed.' });
  });
}

router.post('/upload', protect, multerNotesUpload, ctrl.uploadNote);

router.post('/', protect, ctrl.createNote);
router.get('/', protect, ctrl.getNotes);
router.post('/:id/ai', protect, ctrl.noteAiPipeline);
router.delete('/:id/ai/:outputId', protect, ctrl.deleteNoteAiOutput);
router.put('/:id', protect, ctrl.updateNote);
router.get('/:id', protect, ctrl.getNoteById);
router.delete('/:id', protect, ctrl.deleteNote);

module.exports = router;
