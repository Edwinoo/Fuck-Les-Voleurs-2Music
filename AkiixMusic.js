const { Client, Util } = require('discord.js');
const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const client = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

const activities_list = [
    "<Aide | By Edwin [V1.0]",
    "<Aide | By Edwin [V1.0]",
    "Discord ► https://discord.gg/dehgnGp"
    ];

client.on('ready', () => {
    setInterval(() => {
        const index = Math.floor(Math.random() * (activities_list.length - 1) + 1);
        client.user.setPresence(activities_list[index]);
    }, 10000);
});

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Akiix Music !'));

client.on('disconnect', () => console.log('JAI PTETRE BUG'));

client.on('reconnecting', () => console.log('JSUIS REVENU'));

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('⚠️Connectes-toi dans un salon vocal, sinon pas de musique !⚠️');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('⛔️Ooh Es que ta les perms parce que la sa bug !⛔️');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('⚠️Mec tu veux de la musique, mais j ai même pas l droit pour parler...⚠️');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** a été ajouté à la file d'attente!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Sélection de la chanson:**__

${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Veuillez fournir une valeur pour sélectionner l'un des résultats de la recherche, allant de 1 à 10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('🖕🏼 Aucune valeur ou valeur invalide entrée, annulant la sélection de vidéo.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 J ai rien trouvé dans ma recherche !');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('T pas dans l salon !');
		if (!serverQueue) return msg.channel.send('tu veux que je saute quoi ? ya rien de lancer..');
		serverQueue.connection.dispatcher.end('⏭ Ok bah jlance l autre');
		return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('T pas dans l salon !');
		if (!serverQueue) return msg.channel.send('tu veux que j arrete quoi ? ya rien de lancer..');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('⏹ya plus de musique !');
		return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('T pas dans l salon !');
		if (!serverQueue) return msg.channel.send('🔇Aucune musique-là !');
		if (!args[1]) return msg.channel.send(`Le volume actuel est: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Je règle le volume à: **${args[1]}**`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('🔇Aucune musique-là !');
		return msg.channel.send(`🎶 Tu écoute: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('🔇Aucune musique-là !');
		return msg.channel.send(`
__**File d'attente des chansons:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Tu écoute:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ Dit moi quand jrelance ! [<resume]');
		}
		return msg.channel.send('🔇Aucune musique-là !');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶️ Ça recommence !');
		}
		return msg.channel.send('🔇Aucune musique-là !');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`[⚠️] Deso j ai loupé lbus: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`[⚠️] Deso j ai loupé lbus: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** a été ajouté à la file d'attente!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('fin', reason => {
			if (reason === 'Le flux ne génère pas assez rapidement.') console.log('Chanson terminée.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 J ai lancé: **${song.title}**`);
}

client.login(process.env.TOKEN);
