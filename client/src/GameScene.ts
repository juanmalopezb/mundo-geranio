import Phaser from "phaser";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import type { MapSchema } from "@colyseus/schema";

interface PlayerState {
  x: number;
  y: number;
}

interface GameState {
  players: MapSchema<PlayerState>;
}

interface MoveMessage {
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private room?: Room<GameState>;
  private readonly playerEntities = new Map<
    string,
    Phaser.GameObjects.Rectangle
  >();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private sendAccumulator = 0;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#263b2c");
    this.cursors = this.input.keyboard?.createCursorKeys();

    const client = new Client("ws://localhost:2567");
    void client
      .joinOrCreate<GameState>("geranio_room")
      .then((room) => {
        this.room = room;
        console.info("Conectado a Mundo Geranio:", room.sessionId);

        const callbacks = getStateCallbacks(room);
        callbacks(room.state).players.onAdd((player, sessionId) => {
          const color = Phaser.Display.Color.RandomRGB().color;
          const rectangle = this.add.rectangle(
            player.x,
            player.y,
            40,
            40,
            color,
          );
          rectangle.setStrokeStyle(2, 0xffffff);
          this.playerEntities.set(sessionId, rectangle);

          callbacks(player).onChange(() => {
            this.tweens.killTweensOf(rectangle);
            this.tweens.add({
              targets: rectangle,
              x: player.x,
              y: player.y,
              duration: 100,
              ease: "Linear",
            });
          });
        });

        callbacks(room.state).players.onRemove((_player, sessionId) => {
          this.playerEntities.get(sessionId)?.destroy();
          this.playerEntities.delete(sessionId);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          void room.leave();
          this.playerEntities.clear();
        });
      })
      .catch((error: unknown) => {
        console.error("Error al conectar con el servidor Mundo Geranio:", error);
      });
  }

  update(_time: number, delta: number): void {
    if (!this.room || !this.cursors) return;

    const directionX =
      Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const directionY =
      Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);

    this.sendAccumulator += delta;
    if (this.sendAccumulator < 100) return;

    const elapsed = Math.min(this.sendAccumulator, 200);
    this.sendAccumulator %= 100;

    if (directionX === 0 && directionY === 0) return;

    const magnitude = Math.hypot(directionX, directionY);
    const distance = (180 * elapsed) / 1000;
    const message: MoveMessage = {
      x: (directionX / magnitude) * distance,
      y: (directionY / magnitude) * distance,
    };

    this.room.send("move", message);
  }
}
