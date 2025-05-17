const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const ClubRegistration = require('../models/ClubRegistration');
const { authenticateToken } = require('./auth');

// جلب قائمة النوادي
router.get('/', async (req, res) => {
    try {
        const clubs = await Club.find().sort({ createdAt: -1 });
        res.json(clubs);
    } catch (error) {
        console.error('خطأ في جلب قائمة النوادي:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب تفاصيل نادي معين
router.get('/:id', async (req, res) => {
    try {
        const club = await Club.findById(req.params.id);
        if (!club) {
            return res.status(404).json({ message: 'النادي غير موجود' });
        }
        res.json(club);
    } catch (error) {
        console.error('خطأ في جلب تفاصيل النادي:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// التسجيل في نادي
router.post('/register', authenticateToken, async (req, res) => {
    try {
        // التحقق من أن المستخدم طالب
        if (req.user.type !== 'student') {
            return res.status(403).json({ message: 'يجب أن تكون طالباً للتسجيل في النوادي' });
        }
        
        const { clubId, name, major, skills } = req.body;
        
        // التحقق من وجود النادي
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ message: 'النادي غير موجود' });
        }
        
        // التحقق من عدم التسجيل المسبق
        const existingRegistration = await ClubRegistration.findOne({ 
            userId: req.user.id, 
            clubId 
        });
        
        if (existingRegistration) {
            return res.status(400).json({ message: 'أنت مسجل بالفعل في هذا النادي' });
        }
        
        // إنشاء تسجيل جديد
        const registration = new ClubRegistration({
            userId: req.user.id,
            clubId,
            name,
            major,
            skills
        });
        
        await registration.save();
        
        res.status(201).json({ 
            message: 'تم التسجيل بنجاح', 
            registration 
        });
    } catch (error) {
        console.error('خطأ في التسجيل في النادي:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب النوادي المسجل فيها الطالب
router.get('/my-clubs', authenticateToken, async (req, res) => {
    try {
        // التحقق من أن المستخدم طالب
        if (req.user.type !== 'student') {
            return res.status(403).json({ message: 'مسار خاص بالطلاب فقط' });
        }
        
        const registrations = await ClubRegistration.find({ 
            userId: req.user.id 
        }).populate('clubId');
        
        res.json(registrations);
    } catch (error) {
        console.error('خطأ في جلب النوادي المسجل فيها:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;