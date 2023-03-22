const mongoose = require("mongoose");

const { Schema, model } = mongoose;



const UserSchema = new Schema({
    username: {
        type: String,
        unique: true,
    },
    password: String,
})

const Usermodel = model("User", UserSchema);
module.exports = Usermodel;