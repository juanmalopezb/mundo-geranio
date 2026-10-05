import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/world';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    parent: 'app',
    backgroundColor: '#4d8a54', 
    scene: [GameScene],
    input: { activePointers: 2 },
    scale: { mode: Phaser.Scale.RESIZE },
};

export default new Phaser.Game(config);
