import Phaser from 'phaser';
import { GameScene } from './GameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth, // Ocupará toda la pantalla
    height: window.innerHeight,
    parent: 'app',
    backgroundColor: '#4d8a54', 
    scene: [GameScene]
};

export default new Phaser.Game(config);