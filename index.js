const express = require("express")
const mongoose = require("mongoose");
const User = require("./models/User");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieparser = require("cookie-parser");
const bcrypt = require("bcrypt");
const secret = "kjkjsdbckbfiuerhfndbiwfhscb";
const salt = bcrypt.genSaltSync(10);
const ws = require("ws");
const Message = require("./models/Message");
require("dotenv").config();


const app = express();
app.use(express.json());
app.use(cookieparser())
mongoose.connect(process.env.MONGO_URL).then(() => console.log("coonected to database successfully")).catch(err => console.log(err))
app.use(cors({
    credentials: true,
    origin: "http://localhost:5173"
}));


app.get('/messages/:userId', async(req, res) => {
    const { userId } = req.params;

    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] }
    }).sort({ createdAt: -1 }).exec();
    res.json(messages)
    console.log(userId);
    console.log(ourUserId)
    console.log("msgs are", messages);

})

app.get("/people", async(req, res) => {
    const users = await User.find({}, { "_id": 1, username: 1 });
    res.json(users);
})



async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies ? req.cookies.token : null;
        if (token) {
            jwt.verify(token, secret, {}, (err, userData) => {
                if (err) throw err;
                resolve(userData)
            })

        } else {
            reject("no token !!!")
        }
    })
}





app.get("/", (req, res) => {
    res.send("i love mern techs");
})


app.get("/profile", (req, res) => {
    const token = req.cookies ? req.cookies.token : 1;
    if (token) {
        jwt.verify(token, secret, {}, (err, userData) => {
            if (err) throw err;
            res.json(userData);
        })

    } else {
        res.status(401).json("no token found!!")
    }

})








app.post("/register", async(req, res) => {

    const { username, password } = req.body;
    try {
        const hashedpassword = bcrypt.hashSync(password, salt);
        const createdUser = await User.create({
            username: username,
            password: hashedpassword
        });

        jwt.sign({ userId: createdUser._id, username: createdUser.username }, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie("token", token, { sameSite: 'none', secure: true }).status(200).json({ id: createdUser._id, username: createdUser.username });
        });


    } catch (err) {
        if (err) throw err;
        res.status(500).json("internal error");
    }


});


app.post('/login', async(req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOneo({ username: username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            jwt.sign({ userId: foundUser._id, username }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token, { sameSite: 'none', secure: true }).json({
                    id: foundUser._id,
                });
            });
        }
    }
});



app.post("/logout", (req, res) => {
    res.cookie("token", '', { secure: true, sameSite: 'none' }).json('okk');

});










const server = app.listen(8000, () => console.log("connected to port 8000"))

const wss = new ws.WebSocketServer({ server });
wss.on('connection', (connection, req) => {



    function notifyAboutOnlinepeople() {

        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({
                    userId: c.userId,
                    username: c.username,
                }))
            }))
        })
    }



    connection.isAlive = true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            connection.terminate();
            notifyAboutOnlinepeople();
            console.log('dead');
        }, 1000)


    }, 1000)

    connection.on("pong", () => {
        clearTimeout(connection.deathTimer);
    })

    console.log("coonected to wss");
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, secret, {}, (err, userdata) => {
                    if (err) throw err;
                    const { userId, username } = userdata;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }
    //it also gives isbinary to check its binary or not  along with message !!
    connection.on('message', async(message) => {
        const messageData = JSON.parse(message.toString());
        const { recepient, text } = messageData;
        if (recepient && text) {
            const MessageDoc = await Message.create({
                sender: connection.userId,
                recipient: recepient,
                text
            });
            [...wss.clients].filter(c => c.userId === recepient)
                .forEach(c => c.send(
                    JSON.stringify({
                        text,
                        sender: connection.userId,
                        recepient: recepient,
                        _id: MessageDoc._id
                    })

                ));
        }



    });











    notifyAboutOnlinepeople();

    // notify all about all connectted people when someone connected !...

})