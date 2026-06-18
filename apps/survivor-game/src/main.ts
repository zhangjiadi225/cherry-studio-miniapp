import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element not found');
}

// Prevent context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Start game
new Game(canvas);

// Hide loading
const loading = document.getElementById('loading');
if (loading) loading.style.display = 'none';
