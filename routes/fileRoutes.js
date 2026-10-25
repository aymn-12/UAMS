const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { uploadMaterial, accessMaterialFile, accessSubmissionFile } = require('../controllers/fileController');
const { ROLES } = require('../config/constants');

router.use(protect);

// Upload lecture file (Doctor and Admin)
router.post('/material', authorize(ROLES.DOCTOR, ROLES.ADMIN), upload.single('file'), uploadMaterial);

// Secure stream/download for course materials (Permission-verified for enrolled student / doctor / admin)
router.get('/material/:id/download', accessMaterialFile);

// Secure stream/download for student assignment submissions (Permission-verified for student / doctor / admin)
router.get('/submission/:submissionId/files/:fileIndex/download', accessSubmissionFile);
router.get('/submission/:submissionId/download', (req, res, next) => {
  req.params.fileIndex = '0';
  next();
}, accessSubmissionFile);

module.exports = router;
