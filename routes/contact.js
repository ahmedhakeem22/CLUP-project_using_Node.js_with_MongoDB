const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// إرسال رسالة تواصل
router.post('/', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        // التحقق من البيانات المدخلة
        if (!name || !email || !message) {
            return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
        }
        
        // إنشاء رسالة تواصل جديدة
        const contact = new Contact({
            name,
            email,
            message
        });
        
        await contact.save();
        
        res.status(201).json({ message: 'تم إرسال رسالتك بنجاح' });
    } catch (error) {
        console.error('خطأ في إرسال رسالة التواصل:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;