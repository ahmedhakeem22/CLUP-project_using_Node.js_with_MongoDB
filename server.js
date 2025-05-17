const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = 'imamu-hub-secret-key';

// الإعدادات الوسيطة
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// توصيل قاعدة البيانات
mongoose.connect('mongodb://localhost:27017/imamuHub')

.then(() => console.log('تم الاتصال بقاعدة البيانات بنجاح'))
.catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

// تضمين الراوتس
const authRoutes = require('./routes/auth').router;
const clubsRoutes = require('./routes/clubs');
const contactRoutes = require('./routes/contact');

// استخدام الراوتس
app.use('/api', authRoutes);
app.use('/api/clubs', clubsRoutes);
app.use('/api/contact', contactRoutes);

// مسار تهيئة البيانات - لإضافة بيانات أولية للنوادي
const Club = require('./models/Club');
// تعريف النماذج (Schemas)
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    type: { type: String, enum: ['student', 'club'], required: true },
    major: { type: String }, // للطلاب فقط
    createdAt: { type: Date, default: Date.now }
});

const clubRegistrationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    name: { type: String, required: true },
    major: { type: String, required: true },
    skills: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now }
});

const clubSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// إنشاء النماذج
const User = mongoose.model('User', userSchema);
const Club = mongoose.model('Club', clubSchema);
const ClubRegistration = mongoose.model('ClubRegistration', clubRegistrationSchema);
const Contact = mongoose.model('Contact', contactSchema);

// المسارات (Routes)

// مسار تسجيل المستخدم
app.post('/api/register', async (req, res) => {
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
        
        res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, type: user.type } });
    } catch (error) {
        console.error('خطأ في تسجيل المستخدم:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// مسار تسجيل الدخول
app.post('/api/login', async (req, res) => {
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
        
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, type: user.type } });
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// التحقق من توكن JWT (middleware)
const authenticateToken = (req, res, next) => {
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
};

// جلب معلومات المستخدم الحالي
app.get('/api/user', authenticateToken, async (req, res) => {
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

// جلب قائمة النوادي
app.get('/api/clubs', async (req, res) => {
    try {
        const clubs = await Club.find().sort({ createdAt: -1 });
        res.json(clubs);
    } catch (error) {
        console.error('خطأ في جلب قائمة النوادي:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب تفاصيل نادي معين
app.get('/api/clubs/:id', async (req, res) => {
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
app.post('/api/club-registration', authenticateToken, async (req, res) => {
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
        const existingRegistration = await ClubRegistration.findOne({ userId: req.user.id, clubId });
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
        
        res.status(201).json({ message: 'تم التسجيل بنجاح', registration });
    } catch (error) {
        console.error('خطأ في التسجيل في النادي:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// جلب النوادي المسجل فيها الطالب
app.get('/api/my-clubs', authenticateToken, async (req, res) => {
    try {
        // التحقق من أن المستخدم طالب
        if (req.user.type !== 'student') {
            return res.status(403).json({ message: 'مسار خاص بالطلاب فقط' });
        }
        
        const registrations = await ClubRegistration.find({ userId: req.user.id }).populate('clubId');
        res.json(registrations);
    } catch (error) {
        console.error('خطأ في جلب النوادي المسجل فيها:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// إرسال رسالة تواصل
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
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

// مسار تهيئة البيانات - لإضافة بيانات أولية للنوادي
app.get('/api/init-data', async (req, res) => {
    try {
        // التحقق من عدم وجود نوادي
        const clubsCount = await Club.countDocuments();
        if (clubsCount > 0) {
            return res.json({ message: 'تم تهيئة البيانات بالفعل' });
        }
        
        // إضافة النوادي
        const clubs = [
            {
                name: 'نادي تيك نشين',
                description: 'يسعى النادي أن يكون رائدا في التقنية وينشر ثقافة التعليم الذاتي للمهارات التقنية خارج المناهج الدراسية لمواكبة العصر.',
                imageUrl: 'https://pbs.twimg.com/profile_images/1843213890496159744/m3_HHwmU_400x400.jpg'
            },
            {
                name: 'نادي أمن المعلومات',
                description: 'يهدف إلى تعزيز مبدأ الحماية من الجرائم الإلكترونية وتصحيح مفهوم أمن المعلومات في أذهان فئات المجتمع.',
                imageUrl: 'https://pbs.twimg.com/profile_images/1639066961651855360/7YeQD5Rv_400x400.jpg'
            },
            {
                name: 'نادي قوقل للطلبة المطورين',
                description: 'سد الفجوة التقنية لدى الطالب والطالبات بثقيفهم بالدورات التعليمية والتطبيق العملي.',
                imageUrl: 'https://pbs.twimg.com/profile_images/1711008586820702208/R33ORhBa_200x200.jpg'
            },
            {
                name: 'نادي الخوارزميات',
                description: 'يسعى إلى تعزيز التعلم الذاتي واختصار الوقت والجهد غبر تقديم خطط ومصادر واضحة لكل مسار.',
                imageUrl: 'a308a20d-3485-43ae-a6f5-4204ff1ee32e.jpg'
            }
        ];
        
        await Club.insertMany(clubs);
        
        res.json({ message: 'تم تهيئة البيانات بنجاح', clubs });
    } catch (error) {
        console.error('خطأ في تهيئة البيانات:', error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});