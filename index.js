// index.js
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const { registerIchancyHandlers } = require('./bot_handlers');

const app = express();
app.use(express.static("public"));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
registerIchancyHandlers(bot);

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/ping", (req, res) => res.send("pong"));

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log("Server running on " + port));
