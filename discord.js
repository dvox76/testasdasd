const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config');
const twitchClient = require('./twitch').twitchClient;

var channelProps = undefined;

client.once('ready', () => {
    console.log('Discord bot is ready and up!');
})

client.on('message', (message) => {
    if (channelProps != undefined) {
        const args = message.content.trim().split(' ');
        if (args[0].String.substr(0, 2) == '!') {
            const command = args[0].String.substr(2);

        }
    }
    else {
        if (args[0] == '!set') {
            channelProps = {
                server: message.guild,
                channel: message.channel,
            }
            message.channel.send('Bot ready!');
        }
    }
});


client.login(config.discordConfig.bot_token);

var discordStreamCheck = 1;
var isOnline = false;

setInterval(() => {
    if (channelProps != undefined) {
        discordStreamCheck--;
        if (discordStreamCheck == 0) {
            twitchClient.api({
                url: `https://api.twitch.tv/kraken/streams/${config.botConfig.channel_name}`,
                headers: {
                    "Client-ID": config.twitchConfig.client_id
                }
            }, (err, res, body) => {
                if (err) return;
                if (body.stream != 0) {
                    if (!isOnline) {
                        var announceChannel = channelProps.server.channels.find((elem) => { return elem.name == config.discordConfig.announce_channel_name});
                        var embed = new Discord.RichEmbed()
                            .setAuthor(config.botConfig.channel_name, body.stream.channel.logo)
                            .setTitle(body.stream.channel.status, body.stream.channel.url)
                            .addField("Game", body.stream.channel.game)
                            .addField("Viewers", body.stream.channel.views, true)
                            .setColor(0xFFA500)
                            .setThumbnail(body.stream.preview.medium);
                        isOnline = true;
                        announceChannel.send(`${body.stream.channel.status} @everyone http://twitch.tv/${config.botConfig.channel_name}`)
                        announceChannel.send({embed});
                    }
                    discordStreamCheck = 20; // 15 sec * 20 = 5 minutes
                }
                else {
                    discordStreamCheck = 1;
                    isOnline = false;
                }
            });
        }
    }
}, 15000);

const parseIsoString = (date) => {
    const startedAt = Date.parse(date);
    var msecs = Math.abs(new Date() - startedAt);

    const years = Math.floor(msecs / (1000 * 60 * 60 * 24 * 365));
    msecs -= years * 1000 * 60 * 60 * 24 * 365;
    const months = Math.floor(msecs / (1000 * 60 * 60 * 24 * 30));
    msecs -= months * 1000 * 60 * 60 * 24 * 30;
    const days = Math.floor(msecs / (1000 * 60 * 60 * 24));
    msecs -= days * 1000 * 60 * 60 * 24;
    const hours = Math.floor(msecs / (1000 * 60 * 60));
    msecs -= hours * 1000 * 60 * 60;
    const mins = Math.floor((msecs / (1000 * 60)));
    msecs -= mins * 1000 * 60;
    const secs = Math.floor(msecs / 1000);
    msecs -= secs * 1000;

    var string = "";
    if (years > 0)
        string += `${years} years `;
    if (months > 0)
        string += `${months} months `;
    if (days > 0)
        string += `${days} days `;
    if (hours > 0)
        string += `${hours} hours `;
    if (mins > 0)
        string += `${mins} mins `;
    if (secs > 0)
        string += `${secs} secs `;

    string = string.trim();

    return string;
}