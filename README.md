# DevVault Pro

AI-powered project & task hub with voice recognition, chat, and collaboration features.

## Features

- ⚡ **Bilgi Kasası** - Store projects, AI instructions, and code snippets
- 📋 **Görev Yönetimi** - Task lists with priorities, due dates, and subtasks
- 🗂️ **Kanban Board** - Visual task management
- 🍅 **Pomodoro Timer** - Focus timer with work/break cycles
- 💬 **Sohbet Odaları** - Create chat rooms for collaboration
- 🎙️ **Ses AI** - Voice-to-text transcription with Groq API
- 📹 **Toplantı Odaları** - Meeting room management

## Deployment to Vercel

### Method 1: Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

### Method 2: Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Click "Deploy"

### Method 3: Direct Upload

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Select "Upload" instead of GitHub
4. Drag and drop your project folder
5. Click "Deploy"

## Environment Variables

### Required for Authentication

Add these environment variables in your Vercel project settings:

- `JWT_SECRET` - Secret key for JWT token generation (use a strong random string)
- `RESEND_API_KEY` - Resend API key for email sending
- `RESEND_FROM_EMAIL` - Sender email address for Resend (e.g., noreply@yourdomain.com)

### Required for AI Features

- `GROQ_API_KEY` - Groq API key for AI chat and voice transcription
- `MISTRAL_API_KEY` - Mistral AI API key
- `HF_TOKEN` - Hugging Face token
- `CLOUDFLARE_API_KEY` - Cloudflare API key

## Local Development

Install dependencies:
```bash
npm install
```

Run local server (frontend):
```bash
npm run dev
```

Run backend server (for authentication and real-time features):
```bash
npm run server
```

Open [http://localhost:3000](http://localhost:3000)

For local development with authentication, create a `.env` file in the project root:
```
JWT_SECRET=your_jwt_secret_here
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
GROQ_API_KEY=your_groq_api_key
MISTRAL_API_KEY=your_mistral_api_key
HF_TOKEN=your_huggingface_token
CLOUDFLARE_API_KEY=your_cloudflare_api_key
```

## Architecture Notes

This is a single-page vanilla JavaScript application using localStorage for data persistence. All features (chat, meetings, authentication) work locally in the browser.

For real multi-user collaboration, a backend server with WebSocket/WebRTC would be required.
