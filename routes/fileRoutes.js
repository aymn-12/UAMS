const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/roleMiddleware');
const { uploadMaterial, accessMaterialFile } = require('../controllers/fileController');
const { ROLES } = require('../config/constants');

router.use(protect);

// Upload lecture file (Doctor only)
router.post('/material', authorize(ROLES.DOCTOR, ROLES.ADMIN), upload.single('file'), uploadMaterial);

// Secure stream/download (Permission-verified for enrolled student / doctor)
router.get('/material/:id/download', accessMaterialFile);

module.exports = router;
