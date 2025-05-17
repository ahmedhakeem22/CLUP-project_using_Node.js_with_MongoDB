const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// متغير سري للتوكن
const JWT_SECRET = 'imamu-hub-secret-key';

// مسار تسجيل المستخدم
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, type, major } = req.body;
        
        // التحقق من عدم وجود البريد الإلكتروني مسبقاً
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
        }
        
        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // إنشاء مستخدم جديد
        const user = new User({
            name,
            email,
            password: hashedPassword,
            type,
            major: type === 'student' ? major : undefined
        });
        
        await user.save();
        
        // إنشاء توكن JWT
        const token = jwt.sign({ id: user._id, type: user.type }, JWT_SECRET, { expiresIn: '1d' });
        
        res.status(201).json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                type: user.type 
            } 
        });
    } catch (error) {
        console.error('خطأ في تسجيل المستخدم:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// مسار تسجيل الدخول
router.post('/login', async (req, res) => {
    try {
        const { email, password, type } = req.body;
        
        // البحث عن المستخدم
        const user = await User.findOne({ email, type });
        if (!user) {
            return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
        }
        
        // التحقق من كلمة المرور
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
        }
        
        // إنشاء توكن JWT
        const token = jwt.sign({ id: user._id, type: user.type }, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                type: user.type 
            } 
        });
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب معلومات المستخدم الحالي
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }
        res.json(user);
    } catch (error) {
        console.error('خطأ في جلب معلومات المستخدم:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// التحقق من توكن JWT (middleware)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'غير مصرح' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'توكن غير صالح' });
        }
        req.user = user;
        next();
    });
}

module.exports = { router, authenticateToken };