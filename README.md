# 🐍 Snake Leader

A modern, geometric arcade Snake Leader game built with HTML5 Canvas, Web Audio sound effects, customizable themes, local leaderboard, and intuitive touch and keyboard controls.

## 🚀 Features

- **🎮 Geometric Arcade Gameplay**: Responsive HTML5 canvas rendering with fluid motion and particles.
- **🔊 Web Audio API**: Dynamic sound effects for eating, leveling up, and game over.
- **🏆 Local Leaderboard**: High-score tracking with local storage persistence.
- **🎨 Theme Support**: Sleek Light and Dark geometric visual themes.
- **📱 Responsive & Cross-Platform**: Keyboard and touch-friendly controls.

## 🛠️ Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+)

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/praneth2274/snake-leader.git
   cd snake-leader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   Copy `.env.example` to `.env.local` and set your variables:
   ```bash
   cp .env.example .env.local
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Deploy to Render

This project is pre-configured for **Render Static Sites**:
1. Connect this GitHub repository on [Render](https://render.com).
2. Set **Build Command**: `npm run build`
3. Set **Publish Directory**: `dist`
4. Click **Create Static Site**.
