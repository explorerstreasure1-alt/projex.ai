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

If you want to set a default Groq API key for your deployed app:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add: `GROQ_API_KEY` with your key value

## Local Development

Install dependencies:
```bash
npm install
```

Run local server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture Notes

This is a single-page vanilla JavaScript application using localStorage for data persistence. All features (chat, meetings, authentication) work locally in the browser.

For real multi-user collaboration, a backend server with WebSocket/WebRTC would be required.
