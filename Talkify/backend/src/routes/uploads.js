const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads')
    fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname)
    cb(null, `${uniqueSuffix}${ext}`)
  }
})

const upload = multer({ storage })

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' })
  }

  const url = `/uploads/${req.file.filename}`

  let type = 'file'
  if (req.file.mimetype.startsWith('image/')) {
    type = 'image'
  } else if (req.file.mimetype.startsWith('video/')) {
    type = 'video'
  }

  return res.status(201).json({
    url,
    type,
    name: req.file.originalname,
    size: req.file.size
  })
})

module.exports = router

