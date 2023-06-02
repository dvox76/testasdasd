const {
    modCheck,
    errorHandler,
    helpHandler
} = require('../helpers');

class Commands {
    constructor(config, client, linkSpamMiddleware, blacklistMiddleware, announceMiddleware) {
        // Variables
        this.channel_name = config.channel_name;
        this.client_id = config.client_id;
        this.spotify_config = config.spotifyConfig;
        this.twitch_config = config.twitchConfig;
        this.server_config = config.serverConfig;
        this.is_local = config.isLocal;
        this.timeout = config.timeout;
        this.client = client;
        this.command_container = [];
        this.counter_container = [];
        this.quote_container = [];
        this.linkSpamMiddleware = linkSpamMiddleware;
        this.blacklistMiddleware = blacklistMiddleware;
        this.announceMiddleware = announceMiddleware;
        this.lastRequest = new Date();
        this.fs = require('fs');
        this.spotifyApi = null;
        this.twitchApi = require('twitch-api-v5');
        this.twitchTokenOption = {
            client: {
                id: this.twitch_config.client_id,
                secret: this.twitch_config.client_secret,
            },
            auth: {
                tokenHost: 'https://id.twitch.tv/',
                authorizePath: 'oauth2/authorize',
                tokenPath: 'oauth2/token',
            }
        };
        this.twitchAuth = null;
        this.isTwitchAuthenticated = false;
        this.isSpotifyAuthenticated = false;

        // Initialization
        if (this.fs.existsSync(`./#${this.channel_name.toLowerCase()}-commands.json`)) {
            const commandsRaw = this.fs.readFileSync(`./#${this.channel_name.toLowerCase()}-commands.json`);
            this.command_container = JSON.parse(commandsRaw);
        }

        if (this.fs.existsSync(`./#${this.channel_name.toLowerCase()}-counters.json`)) {
            const countersRaw = this.fs.readFileSync(`./#${this.channel_name.toLowerCase()}-counters.json`);
            this.counter_container = JSON.parse(countersRaw);
        }

        if (this.fs.existsSync(`./#${this.channel_name.toLowerCase()}-quotes.json`)) {
            const quotesRaw = this.fs.readFileSync(`./#${this.channel_name.toLowerCase()}-quotes.json`);
            this.quote_container = JSON.parse(quotesRaw);
        }

        this.special_commands_container = [
            {
                name: 'addcmd',
                function: (msg, target, context) => {
                    if (!modCheck(context)) {
                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: addcmd`, `You are not allowed to use this command!`);
                        return;
                    }
                    try {
                        const commandPayload = msg.substring(11);
                        const parsedArray = commandPayload.split(' ');

                        if (parsedArray.length < 4) {
                            errorHandler(this.client, target, context['display-name'], `Argument count do not match for command execution: addcmd`, `You need at least 4 parameters!`);
                            return;
                        }
                        var jsonObj = {};
                        jsonObj['name'] = parsedArray[0];

                        if (this.command_container.findIndex((value) => {
                                return value.name == parsedArray[0];
                            }) != -1) {
                            errorHandler(this.client, target, context['display-name'], `A command that is in container tried to be added`, `Such a command already exists!`);
                            return;
                        }

                        jsonObj['argCount'] = parsedArray[1];
                        jsonObj['permedRoles'] = parseInt(parsedArray[2]) == 0 ? [] : parsedArray.slice(3, 3 + parseInt(parsedArray[2]));
                        const spaceCount = 3 + parseInt(parsedArray[2]);

                        var elapsed = 0;
                        var spacePos = -1;
                        for (let index = 0; index < commandPayload.length; index++) {
                            if (commandPayload.charAt(index) == ' ')
                                elapsed++;

                            if (elapsed == spaceCount) {
                                spacePos = index + 1;
                                break;
                            }
                        }

                        jsonObj['function'] = `(params, client, context, msg, target, config) => {${commandPayload.substring(spacePos)}}`;

                        this.command_container.push(jsonObj);
                        this.fs.writeFileSync(`./${target}-commands.json`, JSON.stringify(this.command_container), {
                            flag: 'w'
                        });
                        helpHandler(this.client, target, context['display-name'], `New command added: ${jsonObj.name}`, 'Command successfully added!');
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `Wrong syntax for adding command. Input: ${msg.substring(11)}`, 'Syntax is wrong!');
                    }
                }
            },
            {
                name: 'addquote',
                function: (msg, target, context) => {
                    if (!modCheck(context)) {
                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: addquote`, `You are not allowed to use this command!`);
                        return;
                    }
                    try {
                        const commandPayload = msg.substring(9);
                        const parsedArray = commandPayload.split(' ');

                        if (parsedArray.length < 2) {
                            errorHandler(this.client, target, context['display-name'], `Argument count do not match for command execution: addquote`, `You need at least 2 parameters!`);
                            return;
                        }
                        var jsonObj = {};
                        jsonObj['name'] = parsedArray[0];
                        if (this.command_container.findIndex((value) => {
                                return value.name == parsedArray[0];
                            }) != -1) {
                            errorHandler(this.client, target, context['display-name'], `A command that is in container tried to be added`, `Such a command already exists!`);
                            return;
                        }
                        jsonObj['argCount'] = 0;
                        jsonObj['permedRoles'] = [];
                        var spacePos = commandPayload.indexOf(' ');

                        jsonObj['function'] = `(params, client, context, msg, target, config) => {client.say(target, '${commandPayload.substring(spacePos).trim().replace('"', "\"")}')}`;

                        this.command_container.push(jsonObj);
                        this.fs.writeFileSync(`./${target}-commands.json`, JSON.stringify(this.command_container), {
                            flag: 'w'
                        });
                        helpHandler(this.client, target, context['display-name'], `New command added: ${jsonObj.name}`, 'Command successfully added!');
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `Wrong syntax for adding command. Input: ${msg.substring(9)}`, 'Syntax is wrong!');
                    }
                }
            },
            {
                name: 'delcmd',
                function: (msg, target, context) => {
                    if (!modCheck(context)) {
                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: delcmd`, `You are not allowed to use this command!`);
                        return;
                    }
                    try {
                        const commandPayload = msg.substring(10);

                        let pos = this.command_container.findIndex((value) => {
                            return value.name == commandPayload
                        });

                        if (pos != -1) {
                            this.command_container.splice(pos, 1);
                            this.fs.writeFileSync(`./${target}-commands.json`, JSON.stringify(this.command_container), {
                                flag: 'w'
                            });
                            helpHandler(this.client, target, context['display-name'], `Command is deleted: ${commandPayload}`, 'Command successfully deleted!');
                        } else {
                            errorHandler(this.client, target, context['display-name'], `A command that is not in container tried to be removed`, `No such command found!`);
                        }
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `Wrong syntax for removing command. Input: ${msg.substring(11)}`, 'Syntax is wrong!');
                    }
                }
            },
            {
                name: 'commands',
                function: (msg, target, context) => {
                    try {
                        var string = "";
                        var totalContainer = this.command_container.concat(this.special_commands_container).concat(this.counter_container);
                        totalContainer.sort((a, b) => { return a.name.localeCompare(b.name); })
                        totalContainer.forEach((value, index) => {
                            string += "!" + value['name'];
                            if (index < totalContainer.length - 1)
                                string += " ";
                        })

                        client.say(target, `Available commands: ${string}`);
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `Wrong syntax for listing command. Input: ${msg.substring(11)}`, 'Syntax is wrong!');
                    }
                }
            },
            {
                name: 'uptime',
                function: (msg, target, context) => {
                    try {
                        this.client.api({
                            url: `https://api.twitch.tv/helix/streams?user_login=${target.substring(1)}&first=20`,
                            headers: {
                                "Client-ID": this.twitch_config.client_id
                            }
                        }, (err, res, body) => {
                            if (body.data.length == 0) {
                                this.client.say(target, `${this.channel_name} offline`);
                                return;
                            } else {
                                const string = this.parseIsoString(body.data[0].started_at);

                                this.client.say(target, `${this.channel_name} has been live for ${string}!`);
                            }
                        });
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
            {
                name: 'blacklist',
                function: (msg, target, context) => {
                    try {
                        if (!modCheck(context)) {
                            errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: blacklist`, `You are not allowed to use this command!`);
                            return;
                        }
                        const args = msg.split(' ');
                        if (args[1] == 'add') {
                            if (this.blacklistMiddleware.addToBlacklist(args[2])) {
                                this.client.say(target, 'Word successfully added to blacklist');
                            } else
                                errorHandler(this.client, target, context['display-name'], `A word that already is blacklisted is tried to be added to blacklist`, 'You blacklisted a word that was!');
                        } else if (args[1] == 'del') {
                            if (this.blacklistMiddleware.removeFromBlacklist(args[2])) {
                                this.client.say(target, 'Word successfully deleted from blacklist');
                            } else
                                errorHandler(this.client, target, context['display-name'], `A word that is not blacklisted is tried to be removed from blacklist`, `You tried to blacklist a word that doesn't exist!`);
                        }
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
            {
                name: 'permit',
                function: (msg, target, context) => {
                    try {
                        if (!modCheck(context)) {
                            errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: permit`, `You are not allowed to use this command!`);
                            return;
                        }
                        const args = msg.split(' ');

                        if (args.length !== 3) {
                            errorHandler(this.client, target, context['display-name'], `Unsufficient number of arguments: !permit`, 'You need to enter 2 parameters!');
                            return;
                        }

                        if (this.linkSpamMiddleware.addToPermittedList(args[1], args[2]))
                            this.client.say(target, `User ${args[1]} will be able to link for ${args[2]} minutes!`);
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
            {
                name: 'announce',
                function: (msg, target, context) => {
                    try {
                        if (!modCheck(context)) {
                            errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: announce`, `You are not allowed to use this command!`);
                            return;
                        }
                        const args = msg.split(' ');
                        if (args[1] == 'add') {
                            const spaceCount = 4;

                            var elapsed = 0;
                            var spacePos = -1;
                            for (let index = 0; index < msg.length; index++) {
                                if (msg.charAt(index) == ' ') {
                                    elapsed++;
                                }

                                if (elapsed == spaceCount) {
                                    spacePos = index + 1;
                                    break;
                                }
                            }

                            const title = args[2];
                            const interval = parseInt(args[3]);
                            const body = msg.substring(spacePos);

                            if (this.announceMiddleware.addAnnounce(title, body, interval))
                                helpHandler(this.client, target, context['display-name'], `New announce added: ${title}`, 'Successfully added the announcement');
                            else
                                errorHandler(this.client, target, context['display-name'], `A word that already is in announce list is tried to be added to announce list`, 'You added an announcement as an announcement!');
                        } else if (args[1] == 'del') {
                            if (this.announceMiddleware.removeAnnounce(args[2])) {
                                helpHandler(this.client, target, context['display-name'], `An announce removed: ${args[2]}`, 'Announcement successfully deleted');
                            } else
                                errorHandler(this.client, target, context['display-name'], `A word that is not in announce list is tried to be removed from announce list`, `You tried to delete an announcement that didn't exist!`);
                        }
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
            {
                name: 'counter',
                function: (msg, target, context) => {
                    try {
                        const args = msg.split(' ');
                        if (args[1] == 'add') {
                            if (!modCheck(context)) {
                                errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: counter`, `You are not allowed to use this command!`);
                                return;
                            }
                            const spaceCount = 3;

                            var elapsed = 0;
                            var spacePos = -1;
                            for (let index = 0; index < msg.length; index++) {
                                if (msg.charAt(index) == ' ') {
                                    elapsed++;
                                }

                                if (elapsed == spaceCount) {
                                    spacePos = index + 1;
                                    break;
                                }
                            }

                            const name = args[2];
                            const synthax = msg.substring(spacePos);

                            if (this.counter_container.findIndex((value) => { return value.name == name; }) != -1) {
                                errorHandler(this.client, target, context['display-name'], `A word that already is in counter list is tried to be added to counter list`, 'You added a counter that already existed as a meter!');
                                return;
                            }

                            if (synthax.search('%param') == -1) {
                                errorHandler(this.client, target, context['display-name'], `A word that is tried to be added to counter list has not correct synthax`, 'Make sure you have "%param" in your syntax!');
                                return;
                            }

                            this.counter_container.push({
                                name: name,
                                count: 0,
                                synthax: synthax,
                            });

                            this.fs.writeFileSync(`./${target}-counters.json`, JSON.stringify(this.counter_container), {
                                flag: 'w'
                            });
                            helpHandler(this.client, target, context['display-name'], `New counter added: ${name}`, 'Counter successfully added');
                        } else if (args[1] == 'del') {
                            if (!modCheck(context)) {
                                errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: counter`, `You are not allowed to use this command!`);
                                return;
                            }

                            const name = args[2];
                            const ind = this.counter_container.findIndex((value) => { return value.name == name; });

                            if (ind == -1) {
                                errorHandler(this.client, target, context['display-name'], `A word that is not in counter list is tried to be removed from counter list`, `You tried to erase a meter that didn't exist!`);
                                return;
                            }

                            this.counter_container.splice(ind, 1);

                            this.fs.writeFileSync(`./${target}-counters.json`, JSON.stringify(this.counter_container), {
                                flag: 'w'
                            });
                            helpHandler(this.client, target, context['display-name'], `A counter removed: ${args[2]}`, 'Counter successfully deleted');
                        }
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
            {
                name: 'quote',
                function: (msg, target, context) => {
                    try {
                        const args = msg.split(' ');
                        if (args[1] == 'add') {
                            if (!modCheck(context)) {
                                errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: quote`, `You are not allowed to use this command!`);
                                return;
                            }
                            const spaceCount = 3;

                            var elapsed = 0;
                            var spacePos = -1;
                            for (let index = 0; index < msg.length; index++) {
                                if (msg.charAt(index) == ' ') {
                                    elapsed++;
                                }

                                if (elapsed == spaceCount) {
                                    spacePos = index + 1;
                                    break;
                                }
                            }

                            const newQuote = {
                                quote: msg.substring(spacePos),
                                quotedFrom: args[2],
                                date: new Date().toISOString(),
                            };

                            this.quote_container.push(newQuote);

                            this.fs.writeFileSync(`./${target}-quotes.json`, JSON.stringify(this.quote_container), {
                                flag: 'w'
                            });
                            helpHandler(this.client, target, context['display-name'], `New quote added at ${newQuote.date.toLocaleString('en-US')} with content: ${newQuote.quote}`, 'Quote successfully added');
                        } else if (args[1] == 'del') {
                            if (!modCheck(context)) {
                                errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: quote`, `You are not allowed to use this command!`);
                                return;
                            }

                            const last = this.quote_container.length - 1;

                            if (last == -1) {
                                errorHandler(this.client, target, context['display-name'], `No quote is found in quotes list`, 'No quotes found!');
                                return;
                            }

                            this.quote_container.splice(last, 1);

                            this.fs.writeFileSync(`./${target}-quotes.json`, JSON.stringify(this.quote_container), {
                                flag: 'w'
                            });
                            helpHandler(this.client, target, context['display-name'], `Last added quote is removed`, 'The last added quote has been deleted!');
                        } else {
                            if (this.quote_container.length == 0) {
                                errorHandler(this.client, target, context['display-name'], `No quote is found in quotes list`, 'No quotes found!');
                                return;
                            }

                            const randIndex = Math.floor(Math.random() * this.quote_container.length);
                            const randomQuote = this.quote_container[randIndex];
                            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'Europe/Istanbul' };
                            this.client.say(target, `${randomQuote.quote}, ${randomQuote.quotedFrom} - ${new Date(randomQuote.date).toLocaleDateString('tr-TR', options)}`);
                        }
                    } catch (error) {
                        errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                    }
                }
            },
        ]

        if (this.spotify_config && this.twitch_config) {
            var express = require('express');
            var app = express();

            if (!this.is_local) {
                app.get('/register_spotify', (req, res) => {
                    if (this.isSpotifyAuthenticated) {
                        res.statusCode = 401;
                        res.send('Already authenticated!');
                        return;
                    }
                    var scopes = ['user-read-private', 'user-read-email', 'user-read-currently-playing', 'user-read-playback-state'];
                    var spotifyAuthorizeURL = this.spotifyApi.createAuthorizeURL(scopes, 'state');

                    res.redirect(spotifyAuthorizeURL);
                });

                app.get('/register_twitch', (req, res) => {
                    if (this.isTwitchAuthenticated) {
                        res.statusCode = 401;
                        res.send('Already authenticated!');
                        return;
                    }

                    let twitchOauth = require('simple-oauth2').create(this.twitchTokenOption);
                    var scopes = ['clips:edit', 'channel_editor', 'channel_subscriptions', 'channel_read', 'channel_subscriptions', 'channel_commercial'];
                    const twitchAuthorizeURL = twitchOauth.authorizationCode.authorizeURL({
                        redirect_uri: `http://${this.server_config.hostname}:${this.server_config.port}/callback_twitch`,
                        scope: scopes,
                        state: 'state',
                    })

                    res.redirect(twitchAuthorizeURL);
                });
            }

            app.get('/callback_spotify', (req, res) => {
                const code = req.query.code;

                var tokens = null;

                this.spotifyApi.authorizationCodeGrant(code).then((data) => {
                    // Set the access token on the API object to use it in later calls
                    tokens = {
                        access_token: data.body['access_token'],
                        refresh_token: data.body['refresh_token'],
                    }

                    this.spotifyApi.setAccessToken(tokens['access_token']);
                    this.spotifyApi.setRefreshToken(tokens['refresh_token']);

                    res.send('Spotify is configured!');
                    console.log('Spotify tokens are obtained!');
                    this.isSpotifyAuthenticated = true;
                })
            });

            app.get('/callback_twitch', async (req, res) => {
                const {
                    code
                } = req.query;

                this.twitchApi.clientID = this.twitch_config.client_id;

                this.twitchApi.auth.getAccessToken({
                    clientSecret: this.twitch_config.client_secret,
                    redirectURI: `http://${this.server_config.hostname}:${this.server_config.port}`,
                    code: code
                }, (_, data) => {
                    this.twitchAuth = data;
                    res.send('Twitch is configured!');
                    console.log('Twitch tokens are obtained!')
                    this.isTwitchAuthenticated = true;
                });
            });

            var server = app.listen(this.server_config.port, () => {
                console.log('OAuth2.0 server is ready and up!');

                const SpotifyWebApi = require('spotify-web-api-node');

                var credentials = {
                    clientId: this.spotify_config.client_id,
                    clientSecret: this.spotify_config.client_secret,
                    redirectUri: `http://${this.server_config.hostname}:${this.server_config.port}/callback_spotify`,
                };

                this.spotifyApi = new SpotifyWebApi(credentials);

                if (this.is_local) {
                    var scopes = ['user-read-private', 'user-read-email', 'user-read-currently-playing', 'user-read-playback-state'];
                    var spotifyAuthorizeURL = this.spotifyApi.createAuthorizeURL(scopes, 'state');

                    var opn = require('opn');

                    let twitchOauth = require('simple-oauth2').create(this.twitchTokenOption);
                    scopes = ['clips:edit', 'channel_editor', 'channel_subscriptions', 'channel_read', 'channel_subscriptions', 'channel_commercial'];
                    const twitchAuthorizeURL = twitchOauth.authorizationCode.authorizeURL({
                        redirect_uri: `http://${this.server_config.hostname}:${this.server_config.port}/callback_twitch`,
                        scope: scopes,
                        state: 'state',
                    })

                    opn(spotifyAuthorizeURL);
                    opn(twitchAuthorizeURL);
                }

                this.special_commands_container = this.special_commands_container.concat([
                    {
                        name: 'playing',
                        function: (msg, target, context) => {
                            this.spotifyApi.refreshAccessToken().then((data) => {
                                this.spotifyApi.setAccessToken(data.body['access_token']);
                                this.spotifyApi.getMyCurrentPlaybackState({}).then((data2) => {
                                    const response = data2.body.item;
                                    if (data2.body.is_playing) {
                                        var artists = "";
                                        for (let index = 0; index < response.artists.length; index++) {
                                            const element = response.artists[index];

                                            artists += element.name;

                                            if (index < response.artists.length - 1)
                                                artists += ", ";
                                        }

                                        this.client.say(target, `Playing Now: ${artists} - ${response.name}`);
                                    } else {
                                        errorHandler(this.client, target, context['display-name'], `Currently playing song cannot be found.`);
                                    }
                                }, (err) => {
                                    errorHandler(this.client, target, context['display-name'], err.toString(), 'Currently playing song cannot be found.');
                                });
                            })
                        }
                    },
                    {
                        name: 'currentpl',
                        function: (msg, target, context) => {
                            this.spotifyApi.refreshAccessToken().then((data) => {
                                this.spotifyApi.setAccessToken(data.body['access_token']);
                                this.spotifyApi.getMyCurrentPlaybackState({}).then((data2) => {
                                    const response = data2.body.context;
                                    if (data2.body.is_playing) {
                                        this.client.say(target, `The playlist URL that's playing right now: ${response.external_urls.spotify}`);
                                    } else {
                                        errorHandler(this.client, target, context['display-name'], `Currently playing playlist cannot be found.`);
                                    }
                                }, (err) => {
                                    errorHandler(this.client, target, context['display-name'], err.toString(), 'Currently playing playlist cannot be found.');
                                });
                            })
                        }
                    },
                    {
                        name: 'game',
                        function: (msg, target, context) => {
                            try {
                                const args = msg.split(' ');
                                if (args.length > 1) {
                                    if (!modCheck(context)) {
                                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: game`, `You are not allowed to use this command!`);
                                        return;
                                    }
                                    const gameString = msg.substring(6);

                                    this.twitchApi.search.games({
                                        query: gameString
                                    }, (err, gameSearchData) => {
                                        if (err != null)
                                            throw Error(err);

                                        const actualName = gameSearchData.games[0].name;

                                        this.twitchApi.auth.refreshToken({
                                            clientSecret: this.twitch_config.client_secret,
                                            refreshToken: this.twitchAuth.refresh_token
                                        }, (err2, tokenData) => {
                                            if (err2 != null)
                                                throw Error(err2);
                                            this.twitchAuth = tokenData;

                                            this.twitchApi.channels.channel({
                                                auth: this.twitchAuth.access_token
                                            }, (err3, channelData) => {
                                                if (err3 != null)
                                                    throw Error(err3);

                                                this.twitchApi.channels.updateChannel({
                                                    auth: this.twitchAuth.access_token,
                                                    channelID: channelData._id,
                                                    game: actualName
                                                }, (err4, responseData) => {
                                                    if (err4 != null)
                                                        throw Error(err4);

                                                    this.client.say(target, `The game has been changed to ${responseData.game}!`);
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    this.twitchApi.auth.refreshToken({
                                        clientSecret: this.twitch_config.client_secret,
                                        refreshToken: this.twitchAuth.refresh_token
                                    }, (err, tokenData) => {
                                        if (err != null)
                                            throw Error(err);
                                        this.twitchAuth = tokenData;

                                        this.twitchApi.channels.channel({
                                            auth: this.twitchAuth.access_token
                                        }, (err2, channelData) => {
                                            if (err2 != null)
                                                throw Error(err2);

                                            this.client.say(target, `Game: ${channelData.game}!`);
                                        })
                                    });

                                }
                            } catch (error) {
                                errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                            }
                        }
                    },
                    {
                        name: 'title',
                        function: (msg, target, context) => {
                            try {
                                const args = msg.split(' ');
                                if (args.length > 1) { 
                                    if (!modCheck(context)) {
                                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: title`, `You are not allowed to use this command!`);
                                        return;
                                    }
                                    const titleString = msg.substring(6);

                                    this.twitchApi.auth.refreshToken({
                                        clientSecret: this.twitch_config.client_secret,
                                        refreshToken: this.twitchAuth.refresh_token
                                    }, (err, tokenData) => {
                                        if (err != null)
                                            throw Error(err);
                                        this.twitchAuth = tokenData;

                                        this.twitchApi.channels.channel({
                                            auth: this.twitchAuth.access_token
                                        }, (err2, channelData) => {
                                            if (err2 != null)
                                                throw Error(err2);

                                            this.twitchApi.channels.updateChannel({
                                                auth: this.twitchAuth.access_token,
                                                channelID: channelData._id,
                                                status: titleString
                                            }, (err3, responseData) => {
                                                if (err3 != null)
                                                    throw Error(err3);

                                                this.client.say(target, `Title changed to '${responseData.status}'!`);
                                            })
                                        })
                                    });
                                } else {
                                    this.twitchApi.auth.refreshToken({
                                        clientSecret: this.twitch_config.client_secret,
                                        refreshToken: this.twitchAuth.refresh_token
                                    }, (err, tokenData) => {
                                        if (err != null)
                                            throw Error(err);
                                        this.twitchAuth = tokenData;
    
                                        this.twitchApi.channels.channel({
                                            auth: this.twitchAuth.access_token
                                        }, (err2, channelData) => {
                                            if (err2 != null)
                                                throw Error(err2);
    
                                            this.client.say(target, `Title :'${channelData.status}'!`);
                                        })
                                    });
                                }
                            } catch (error) {
                                errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                            }
                        }
                    },
                    {
                        name: 'followage',
                        function: (msg, target, context) => {
                            try {
                                this.twitchApi.auth.refreshToken({
                                    clientSecret: this.twitch_config.client_secret,
                                    refreshToken: this.twitchAuth.refresh_token
                                }, (err, tokenData) => {
                                    if (err != null)
                                        throw Error(err);
                                    this.twitchAuth = tokenData;

                                    this.twitchApi.channels.channel({
                                        auth: this.twitchAuth.access_token
                                    }, (err2, channelData) => {
                                        if (err2 != null)
                                            throw Error(err2);

                                        this.twitchApi.users.checkFollow({
                                            auth: this.twitchAuth.access_token,
                                            channelID: channelData._id,
                                            userID: context['user-id'],
                                        }, (err3, responseData) => {
                                            if (err3 != null)
                                                throw Error(err3);

                                            if (responseData.error) {
                                                this.client.say(target, `No follower data found!`);
                                            } else {
                                                const string = this.parseIsoString(responseData.created_at);
                                                this.client.say(target, `${context['display-name']}, your follow age: ${string}!`);
                                            }
                                        })
                                    })
                                });
                            } catch (error) {
                                errorHandler(this.client, target, context['display-name'], `An error occured: ${error.toString()}`, 'This command failed to run!');
                            }
                        }
                    },
                ])
            });
        }
    }

    runMiddleware(msg, context, target) {
        msg = msg.trim();
        const splitInput = msg.split(' ');

        // Command Check
        if (splitInput[0].charAt(0) != '!')
            return true;

        // Spam Check
        if (new Date() - this.lastRequest <= this.timeout * 1000)
            return false;

        // Check for special commands
        for (let index = 0; index < this.special_commands_container.length; index++) {
            const element = this.special_commands_container[index];

            if ('!' + element['name'] == splitInput[0]) {
                element.function(msg, target, context);
                return false;
            }
        }

        // Check for registered commands
        for (let index = 0; index < this.command_container.length; index++) {
            const element = this.command_container[index];

            if ('!' + element.name == splitInput[0]) {
                if (splitInput.length === parseInt(element.argCount) + 1) {
                    var isAllowed = true;
                    if (element.permedRoles.length != 0) {
                        isAllowed = false;

                        const currentRoles = context['badges'];
                        if (currentRoles != null) {
                            element.permedRoles.forEach(role => {
                                if (currentRoles[role] == '1')
                                    isAllowed = true;
                            });
                        }
                    }

                    if (isAllowed) {
                        try {
                            let params = splitInput.slice(1);
                            var targetFunction = new Function(`return ${element.function}`)();

                            targetFunction(params, this.client, context, msg, target);
                        } catch (error) {
                            errorHandler(this.client, target, context['display-name'], error.toString(), 'An error has occurred!');
                        }
                    } else
                        errorHandler(this.client, target, context['display-name'], `Permissions do not match for command execution: ${element.name}`, 'You are not allowed to use this command!');
                } else
                    errorHandler(this.client, target, context['display-name'], `Wrong command execution: ${element.name}`, `Wrong command usage! You need to enter ${element.argCount} arguments!`);
                return false;
            }
        }

        // Check for counters
        for (let index = 0; index < this.counter_container.length; index++) {
            const element = this.counter_container[index];

            if ('!' + element.name == splitInput[0]) {
                this.counter_container[index].count++;
                this.client.say(target, element.synthax.replace(new RegExp('%param', 'g'), this.counter_container[index].count));

                this.fs.writeFileSync(`./${target}-counters.json`, JSON.stringify(this.counter_container), {
                    flag: 'w'
                });
                return true;
            }
        }
    }

    parseIsoString(date) {
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
}

exports.commandsMiddleware = Commands;