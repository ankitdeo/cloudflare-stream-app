# Cloudflare Stream Live App

A Next.js application that enables users to live stream video recordings from their local machine (webcam/microphone) to Cloudflare Stream, with a full-featured video player for playback.

## Features

- 🎥 **Live Video Recording**: Record video and audio from your webcam and microphone
- ☁️ **Cloudflare Stream Integration**: Direct upload to Cloudflare Stream
- ▶️ **Video Player**: Full-featured custom video player with:
  - Play/Pause controls
  - Volume control (mute/unmute, slider)
  - Progress bar with seeking
  - Time display (current/total)
  - Fullscreen mode
  - Keyboard shortcuts
  - Loading states
- 📚 **Video Library**: Browse and manage all your uploaded videos
- 🎨 **Modern UI**: Clean, responsive design with dark mode support

## Prerequisites

- Node.js 18+ and npm
- A Cloudflare account with Stream enabled
- Cloudflare Account ID
- Cloudflare API Token with Stream:Edit permissions

## Setup

1. **Clone or navigate to the project directory**:
   ```bash
   cd cloudflare-stream-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   
   Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your Cloudflare credentials:
   ```env
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   CLOUDFLARE_API_TOKEN=your_api_token_here
   ```

   **To get your credentials**:
   - Account ID: Found in the Cloudflare Dashboard URL or in your account settings
   - API Token: Create one at https://dash.cloudflare.com/profile/api-tokens
     - Token needs: `Account:Stream:Edit` permission

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Recording Videos

1. Click on the **Record** tab
2. Click **Start Recording** (you'll be prompted to allow camera/microphone access)
3. Record your video
4. Click **Stop Recording** when done
5. The video will automatically upload to Cloudflare Stream
6. Once uploaded, you'll see the video in your library

### Viewing Videos

1. Click on the **Library** tab to see all your videos
2. Click on any video thumbnail to play it
3. Use the video player controls:
   - **Spacebar**: Play/Pause
   - **Arrow Left/Right**: Seek backward/forward (10 seconds)
   - **F**: Toggle fullscreen
   - **M**: Mute/Unmute

## Project Structure

```
cloudflare-stream-app/
├── src/
│   ├── app/
│   │   ├── api/              # Next.js API routes
│   │   │   ├── stream/       # Stream management endpoints
│   │   │   └── videos/       # Video management endpoints
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Main page
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   ├── streaming/        # StreamRecorder component
│   │   ├── player/           # VideoPlayer component
│   │   └── ui/               # Reusable UI components
│   ├── lib/
│   │   ├── cloudflare.ts     # Cloudflare Stream API client
│   │   └── utils.ts          # Utility functions
│   └── types/
│       └── stream.ts         # TypeScript type definitions
├── .env.local.example        # Environment variables template
├── next.config.ts            # Next.js configuration
├── package.json
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## API Routes

- `POST /api/stream/create` - Create a direct upload URL or live input
- `GET /api/stream/status` - Get stream/video status
- `GET /api/videos/list` - List all videos
- `GET /api/videos/[id]` - Get video details with playback URLs

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Cloudflare Stream API** - Video hosting and streaming
- **MediaRecorder API** - Browser-based video recording
- **Lucide React** - Icons

## Development

### Build for production:
```bash
npm run build
```

### Start production server:
```bash
npm start
```

### Run linter:
```bash
npm run lint
```

## Notes

- Videos are recorded in WebM format (VP9 codec preferred, falls back to default)
- Recorded videos are uploaded in chunks for better progress tracking
- Videos must be processed by Cloudflare Stream before they're ready for playback (usually takes a few seconds to minutes depending on video length)
- The app requires HTTPS in production to access camera/microphone (MediaRecorder API requirement)

## Troubleshooting

**Camera/Microphone not working**:
- Ensure you're using HTTPS (required in production)
- Check browser permissions for camera/microphone access
- Try a different browser

**Upload fails**:
- Verify your Cloudflare API token has correct permissions
- Check that your Account ID is correct
- Ensure your API token hasn't expired

**Video not playing**:
- Wait a few minutes for Cloudflare to process the video
- Check the browser console for errors
- Verify the video status in the Cloudflare dashboard

## License

MIT
