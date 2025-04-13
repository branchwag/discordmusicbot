// Discord Music Bot with yt-dlp
// Required packages:
// npm install discord.js @discordjs/voice youtube-sr @discordjs/opus ffmpeg-static

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const YouTube = require('youtube-sr').default;
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { token } = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// Simple queue for songs
const queue = new Map();

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith('!')) return;

  const serverQueue = queue.get(message.guild.id);
  
  if (message.content.startsWith('!play')) {
    executePlay(message, serverQueue);
  } else if (message.content.startsWith('!stop')) {
    if (!serverQueue) return message.channel.send('Nothing is playing!');
    
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    return message.channel.send('Stopped and left the channel!');
  }
});

async function executePlay(message, serverQueue) {
  const args = message.content.split(' ');
  let searchString = args.slice(1).join(' ');
  const voiceChannel = message.member.voice.channel;
  
  if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');
  if (!searchString) return message.channel.send('Please provide a YouTube URL or search term!');
  
  try {
    let videoId;
    let videoTitle;
    
    // Check if it's a YouTube URL
    if (searchString.includes('youtube.com/watch?v=') || searchString.includes('youtu.be/')) {
      console.log(`Detected YouTube URL: ${searchString}`);
      
      // Extract video ID from URL
      if (searchString.includes('youtube.com/watch?v=')) {
        videoId = searchString.split('v=')[1];
        if (videoId.includes('&')) {
          videoId = videoId.split('&')[0];
        }
      } else if (searchString.includes('youtu.be/')) {
        videoId = searchString.split('youtu.be/')[1];
      }
      
      // Get video details
      const videoInfo = await YouTube.getVideo(`https://youtube.com/watch?v=${videoId}`);
      if (!videoInfo) throw new Error('Could not find that video!');
      
      videoTitle = videoInfo.title;
    } else {
      // It's a search term
      console.log(`Searching YouTube for: ${searchString}`);
      
      const results = await YouTube.search(searchString, { limit: 1, type: 'video' });
      if (!results || results.length === 0) throw new Error('No results found!');
      
      videoId = results[0].id;
      videoTitle = results[0].title;
    }
    
    console.log(`Found video: ${videoTitle} (ID: ${videoId})`);
    
    const song = {
      title: videoTitle,
      id: videoId,
      url: `https://youtube.com/watch?v=${videoId}`
    };
    
    if (!serverQueue) {
      // Create a new queue
      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        player: null,
        songs: [],
      };
      
      queue.set(message.guild.id, queueConstruct);
      queueConstruct.songs.push(song);
      
      try {
        const statusMsg = await message.channel.send(`🔄 Preparing to play: ${song.title}`);
        
        // Create a connection
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
          selfDeaf: false // Try not deafening the bot
        });
        
        // Create an audio player
        const player = createAudioPlayer({
          behaviors: {
            noSubscriber: NoSubscriberBehavior.Play
          }
        });
        
        connection.subscribe(player);
        queueConstruct.connection = connection;
        queueConstruct.player = player;
        
        // Play the song
        await playSong(message.guild.id, statusMsg);
      } catch (error) {
        console.error(`Error joining voice channel: ${error.message}`);
        queue.delete(message.guild.id);
        return message.channel.send(`Error: ${error.message}`);
      }
    } else {
      // Add to existing queue
      serverQueue.songs.push(song);
      return message.channel.send(`🎵 Added to queue: ${song.title}`);
    }
  } catch (error) {
    console.error(`Error in executePlay: ${error.message}`);
    return message.channel.send(`Error: ${error.message}`);
  }
}

async function playSong(guildId, statusMsg = null) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue || serverQueue.songs.length === 0) {
    if (serverQueue?.connection) {
      serverQueue.connection.destroy();
    }
    queue.delete(guildId);
    return;
  }
  
  try {
    const song = serverQueue.songs[0];
    console.log(`Starting download for: ${song.title} (ID: ${song.id})`);
    
    if (statusMsg) {
      await statusMsg.edit(`🔄 Downloading: ${song.title}`);
    }
    
    // File path for the audio
    const filePath = path.join(tempDir, `${song.id}.mp3`);
    
    // Check if file already exists (to avoid redownloading)
    if (fs.existsSync(filePath)) {
      console.log(`File already exists, skipping download: ${filePath}`);
      playFile(serverQueue, song, filePath, statusMsg);
      return;
    }
    
    // Using yt-dlp command (make sure yt-dlp is installed or in the same directory)
    // Download the audio to a temp file
    const command = `yt-dlp -x --audio-format mp3 -o "${filePath}" https://www.youtube.com/watch?v=${song.id}`;
    console.log(`Executing command: ${command}`);
    
    // We'll use a Promise to wait for the download to complete
    await new Promise((resolve, reject) => {
      const downloadProcess = exec(command, (error) => {
        if (error) {
          console.error(`Download error: ${error.message}`);
          reject(error);
          return;
        }
        console.log(`Download completed: ${filePath}`);
        resolve();
      });
      
      // Log the download output
      downloadProcess.stdout?.on('data', (data) => {
        console.log(`yt-dlp output: ${data}`);
      });
      
      downloadProcess.stderr?.on('data', (data) => {
        console.error(`yt-dlp error: ${data}`);
      });
    });
    
    // Now play the file
    playFile(serverQueue, song, filePath, statusMsg);
    
  } catch (error) {
    console.error(`Error in playSong: ${error.message}`);
    serverQueue.textChannel.send(`Error playing song: ${error.message}`);
    serverQueue.songs.shift();
    playSong(guildId);
  }
}

function playFile(serverQueue, song, filePath, statusMsg) {
  try {
    // Create a resource from the downloaded file
    const resource = createAudioResource(filePath, {
      inlineVolume: true
    });
    
    // Set volume
    resource.volume.setVolume(1.0);
    
    // Update status message if exists
    if (statusMsg) {
      statusMsg.edit(`🎶 Now playing: ${song.title}`);
    } else {
      serverQueue.textChannel.send(`🎶 Now playing: ${song.title}`);
    }
    
    // Play the song
    serverQueue.player.play(resource);
    
    // Listen for when the song ends
    serverQueue.player.once(AudioPlayerStatus.Idle, () => {
      console.log('Song ended, playing next song');
      
      // Clean up the temp file (optional - you can keep it for caching)
      /*
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Error deleting temp file: ${err.message}`);
      }
      */
      
      // Play next song
      serverQueue.songs.shift();
      playSong(serverQueue.textChannel.guild.id);
    });
    
    // Handle player errors
    serverQueue.player.once('error', error => {
      console.error(`Player error: ${error.message}`);
      serverQueue.textChannel.send(`Error playing song: ${error.message}`);
      
      serverQueue.songs.shift();
      playSong(serverQueue.textChannel.guild.id);
    });
  } catch (error) {
    console.error(`Error playing file: ${error.message}`);
    serverQueue.textChannel.send(`Error playing song: ${error.message}`);
    serverQueue.songs.shift();
    playSong(serverQueue.textChannel.guild.id);
  }
}

client.login(token);
