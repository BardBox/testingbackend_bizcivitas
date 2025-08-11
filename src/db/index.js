import mongoose from "mongoose";
import {dbName} from "../constants.js";
import seedAdmin from "../services/seedAdmin.js";

const connectDb = async () => {
    try{
        const connnectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${dbName}`);
        console.log(`MongoDb is connected at host: ${connnectionInstance.connection.host} `);
        await seedAdmin()
    }catch(err){
        console.log(err);
        process.exit(1);
    }
}

export default connectDb;
