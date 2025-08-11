import mongoose, {Schema} from "mongoose";

const visiterSchema = new Schema({
    fname: {
        type: String,
        require: true,
        trim: true,
    },
    lname: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        require: true,
        lowercase: true,
        unique: true,
        trim: true
    },
    events: {
        type: [Schema.Types.ObjectId],
        require: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    }
},
{
    timestamps: true,
});

export const Visiter = mongoose.model('Visiter', visiterSchema);