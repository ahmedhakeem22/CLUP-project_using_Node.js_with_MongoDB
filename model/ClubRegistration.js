const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clubRegistrationSchema = new Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    clubId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Club', 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    major: { 
        type: String, 
        required: true 
    },
    skills: { 
        type: String, 
        required: true 
    },
    registeredAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('ClubRegistration', clubRegistrationSchema);