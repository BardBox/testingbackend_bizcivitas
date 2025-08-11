import mongoose, { Schema } from "mongoose";

const communitySchema = new Schema({
    communityName: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        default: '',
    },
    coreMembers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    users: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    region: {
        type: String,
        required: true, 
    }
}, { timestamps: true });

export const Community = mongoose.model('Community', communitySchema);