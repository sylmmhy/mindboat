# MindBoat - Focus Through Sailing

MindBoat is an innovative focus and productivity application that uses the metaphor of sailing to help users maintain concentration on their tasks. The application transforms your work tasks into sailing destinations, monitors your focus using advanced distraction detection, and provides a visual journey of your productivity over time.

![MindBoat](https://images.pexels.com/photos/1482193/pexels-photo-1482193.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1)

## 🌊 Features

### Core Features
- **Lighthouse Goal Setting**: Define your long-term goals as a lighthouse that guides your journey
- **AI-Generated Destinations**: Transform regular tasks into imaginative sailing destinations using AI
- **Focus Sailing Mode**: Immersive concentration experience with visual and audio feedback
- **Multi-Modal Distraction Detection**:
  - Tab switching detection
  - Optional camera monitoring
  - Optional screen content analysis
- **Exploration Mode**: Capture notes and ideas when temporarily going off course
- **Voyage Analytics**: Detailed statistics and insights after each focus session
- **Grand Map**: Visual representation of your productivity journey over time
- **Voice Assistant**: Optional voice interactions and recording during your voyage

### Advanced Features
- **High-Precision Timing**: Millisecond-accurate tracking of focus sessions
- **AI-Generated Reflections**: AI analysis of your work patterns and achievements
- **Weather System**: Dynamic visual feedback representing your focus state
- **Seagull Companion**: A friendly companion that provides encouragement and feedback

## 🚀 Technologies

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI/LLM**: Google Gemini API for image analysis, ElevenLabs for voice generation
- **APIs**: Web Audio, MediaDevices, Screen Capture, Speech Recognition

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase account (free tier works fine)
- (Optional) Google Gemini API key
- (Optional) ElevenLabs API key

## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mindboat.git
   cd mindboat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables file:
   ```bash
   cp .env.example .env
   ```

4. Set up your environment variables in the `.env` file:
   ```
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_GEMINI_API_KEY=your-gemini-api-key (optional)
   VITE_ELEVENLABS_API_KEY=your-elevenlabs-api-key (optional)
   ```

5. Set up Supabase:
   - Create a new Supabase project
   - Run the SQL migrations in the `supabase/migrations` folder to create the database schema
   - Deploy the Edge Functions in the `supabase/functions` folder

## 🚢 Development

Start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:5173.

### Database Migrations

All migrations are located in the `supabase/migrations` folder and should be applied in order. You can apply them manually through the Supabase SQL editor or use the Supabase CLI.

### Edge Functions

The project uses Supabase Edge Functions for serverless operations:

- `generate-destination`: Transforms user tasks into sailing destinations
- `generate-reflection`: Creates AI-generated reflections on user progress

## 🏗️ Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` folder.

## 🌐 Deployment

The application can be deployed to any static hosting service. For Supabase integration, make sure your production environment has the correct environment variables.

### Recommended Deployment Platforms

- Vercel
- Netlify
- Supabase Hosting

## 🧠 Using MindBoat

### Getting Started

1. **Create an Account or Use Demo Mode**:
   - Sign up with email and password or try the demo mode

2. **Set Your Lighthouse Goal**:
   - Define your ideal self - what you aspire to become

3. **Create Destinations**:
   - Enter tasks you want to focus on (e.g., "Complete thesis chapter")
   - The system will transform them into sailing destinations with relevant apps

### Focusing with Sailing Mode

1. **Choose a Destination**:
   - Select which task to focus on
   - Set a planned duration for your voyage

2. **Grant Permissions (Optional)**:
   - Camera: Helps detect if you're looking away
   - Microphone: Enables voice interaction
   - Screen sharing: Enables content relevance detection

3. **Start Sailing**:
   - Watch your boat sail across the ocean
   - The interface changes with weather effects based on your focus state
   - Distraction alerts appear if you go off course
   - Choose "Return to Course" or "I'm Exploring" when distracted

4. **End Voyage**:
   - Finish your focus session
   - View comprehensive statistics and insights
   - See your journey added to the Grand Map

### Features to Try

- **Voice Interactions**: If you've provided an ElevenLabs API key, try speaking to the application during distraction alerts
- **Exploration Mode**: When distracted, choose "I'm Exploring" to capture insights and ideas
- **Grand Map**: Review your focus journey and achievements over time
- **Seagull Companion**: Watch for your friendly seagull who appears with encouragement

## 🛡️ Privacy

MindBoat takes privacy seriously:

- Camera and microphone permissions are optional
- All camera/screen analysis is performed locally in the browser
- Voice recordings can be deleted at any time
- All data is stored in your Supabase project which you control

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues to improve the application.

---

Built with ❤️ for focused productivity. May the winds guide your focus!
