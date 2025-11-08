# Discord Music Bot

A simple Discord music bot that plays YouTube videos in voice channels.

## Features
- Play music from YouTube URLs or search terms
- Simple commands for easy use
- Downloads songs before playing for reliable audio quality
- Works with Discord API

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- [FFmpeg](https://ffmpeg.org/download.html)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases)

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install discord.js @discordjs/voice youtube-sr @discordjs/opus ffmpeg-static
   ```
3. Install yt-dlp:
   ```
   pip install yt-dlp
   ```
   Or download the executable from the [releases page](https://github.com/yt-dlp/yt-dlp/releases) and place it in the same directory as your bot.
4. Create a `config.json` file with your Discord bot token:
   ```json
   {
     "token": "YOUR_DISCORD_BOT_TOKEN"
   }
   ```

## Usage

1. Start the bot:
   ```
   node ytdlp-bot.js
   ```

2. Commands:
   - `!play [YouTube URL or search term]` - Play a song
   - `!stop` - Stop playing and leave the channel

## How It Works

This bot downloads YouTube videos using yt-dlp and converts them to audio files before playing them in Discord voice channels. This approach provides better reliability than streaming directly from YouTube.

## License

MIT

## Acknowledgements

- [discord.js](https://discord.js.org/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [youtube-sr](https://github.com/DevSnowflake/youtube-sr)
