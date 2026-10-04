import Phaser from "phaser";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import type { MapSchema } from "@colyseus/schema";

interface PlayerState {
  x: number;
  y: number;
  character: "soso" | "lili" | "guvu";
  score: number;
}

interface CollectibleState {
  x: number;
  y: number;
}

interface GameState {
  players: MapSchema<PlayerState>;
  collectibles: MapSchema<CollectibleState>;
}

interface MoveMessage {
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private room?: Room<GameState>;
  private background?: Phaser.GameObjects.Image;
  private scoreLabel?: Phaser.GameObjects.Text;
  private readonly playerEntities = new Map<
    string,
    Phaser.GameObjects.Sprite
  >();
  private readonly collectibleEntities = new Map<
    string,
    Phaser.GameObjects.Container
  >();
  private readonly collectibleAttempts = new Map<string, number>();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private sendAccumulator = 0;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.image("fondo", "/assets/fondo_geranio.jfif");
    this.load.image("soso", "/assets/soso.png");
    this.load.image("lili", "/assets/lili.png");
    this.load.image("guvu", "/assets/guvu.png");
    this.load.audio("sonido_gota", "/assets/collect.wav");
  }

  create(): void {
    this.background = this.add.image(0, 0, "fondo").setDepth(-1);
    this.resizeBackground();
    this.scale.on(
      Phaser.Scale.Events.RESIZE,
      this.resizeBackground,
      this,
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(
        Phaser.Scale.Events.RESIZE,
        this.resizeBackground,
        this,
      );
    });

    this.cameras.main.setBackgroundColor("#263b2c");
    this.cursors = this.input.keyboard?.createCursorKeys();

    const client = new Client("ws://192.168.1.26:2567");
    void client
      .joinOrCreate<GameState>("geranio_room")
      .then((room) => {
        this.room = room;
        console.info("Conectado a Mundo Geranio:", room.sessionId);

        const callbacks = getStateCallbacks(room);
        callbacks(room.state).players.onAdd((player, sessionId) => {
          const sprite = this.add.sprite(
            player.x,
            player.y,
            player.character,
          );
          sprite.setScale(0.18);
          this.playerEntities.set(sessionId, sprite);

          if (sessionId === room.sessionId) {
            this.scoreLabel = this.add
              .text(20, 20, `Gotas: ${player.score}`, {
                fontFamily: "Arial, sans-serif",
                fontSize: "24px",
                color: "#ffffff",
                backgroundColor: "#245b45cc",
                padding: { x: 12, y: 8 },
              })
              .setScrollFactor(0)
              .setDepth(100);
            this.setCameraBounds();
            this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
          }

          let previousX = player.x;
          let previousScore = player.score;
          let tiltTween: Phaser.Tweens.Tween | undefined;

          callbacks(player).onChange(() => {
            if (sessionId === room.sessionId && this.scoreLabel) {
              this.scoreLabel.setText(`Gotas: ${player.score}`);

              if (player.score > previousScore) {
                this.playCollectSound();

                const notice = this.add
                  .text(sprite.x, sprite.y - 45, "+1 gota", {
                    fontFamily: "Arial, sans-serif",
                    fontSize: "18px",
                    color: "#e6fbff",
                    stroke: "#236b73",
                    strokeThickness: 4,
                  })
                  .setOrigin(0.5)
                  .setDepth(20);

                this.tweens.add({
                  targets: notice,
                  y: notice.y - 32,
                  alpha: 0,
                  duration: 700,
                  ease: "Sine.easeOut",
                  onComplete: () => notice.destroy(),
                });
              }
            }
            previousScore = player.score;

            const vx = player.x - previousX;
            previousX = player.x;

            if (vx > 0) sprite.setFlipX(true);
            else if (vx < 0) sprite.setFlipX(false);

            this.tweens.killTweensOf(sprite);
            this.tweens.add({
              targets: sprite,
              x: player.x,
              y: player.y,
              duration: 100,
              ease: "Linear",
            });

            tiltTween?.stop();
            sprite.setRotation(0);

            if (Math.abs(vx) > 0.1) {
              const tiltState = { angle: 0 };
              const tilt = Phaser.Math.Clamp(vx * 0.006, -0.12, 0.12);

              tiltTween = this.tweens.add({
                targets: tiltState,
                angle: tilt,
                duration: 90,
                hold: 30,
                yoyo: true,
                ease: "Sine.easeOut",
                onUpdate: () => sprite.setRotation(tiltState.angle),
                onComplete: () => sprite.setRotation(0),
              });
            }
          });
        });

        callbacks(room.state).collectibles.onAdd((collectible, id) => {
          const glow = this.add.circle(0, 0, 18, 0x78dfff, 0.22);
          const droplet = this.add.circle(0, 0, 10, 0x8be7ff, 0.95);
          droplet.setStrokeStyle(2, 0xffffff, 0.9);
          const highlight = this.add.circle(-3, -4, 3, 0xffffff, 0.95);
          const visual = this.add
            .container(collectible.x, collectible.y, [glow, droplet, highlight])
            .setDepth(2);

          this.collectibleEntities.set(id, visual);
          this.tweens.add({
            targets: visual,
            y: collectible.y - 5,
            scale: 1.15,
            alpha: 0.78,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        });

        callbacks(room.state).collectibles.onRemove((_collectible, id) => {
          const visual = this.collectibleEntities.get(id);
          if (visual) {
            this.tweens.killTweensOf(visual);
            visual.destroy();
            this.collectibleEntities.delete(id);
          }
          this.collectibleAttempts.delete(id);
        });

        callbacks(room.state).players.onRemove((_player, sessionId) => {
          this.playerEntities.get(sessionId)?.destroy();
          this.playerEntities.delete(sessionId);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          void room.leave();
          this.playerEntities.clear();
          this.collectibleEntities.clear();
          this.collectibleAttempts.clear();
        });
      })
      .catch((error: unknown) => {
        console.error("Error al conectar con el servidor Mundo Geranio:", error);
      });
  }

  private resizeBackground(gameSize?: Phaser.Structs.Size): void {
    if (!this.background) return;

    const width = gameSize?.width ?? this.scale.width;
    const height = gameSize?.height ?? this.scale.height;
    const scale = Math.max(
      width / this.background.width,
      height / this.background.height,
    );

    this.background
      .setPosition(width / 2, height / 2)
      .setDisplaySize(this.background.width * scale, this.background.height * scale);

    this.setCameraBounds();
  }

  private setCameraBounds(): void {
    if (!this.background) return;

    const bounds = this.background.getBounds();
    this.cameras.main.setBounds(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  }

  private playCollectSound(): void {
    if (this.sound.locked) return;
    this.sound.play("sonido_gota", { volume: 0.5 });
  }

  update(time: number, delta: number): void {
    if (!this.room) return;

    let directionX = this.cursors
      ? Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown)
      : 0;
    let directionY = this.cursors
      ? Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown)
      : 0;

    const pointer = this.input.activePointer;
    if (pointer.isDown) {
      const localPlayer = this.playerEntities.get(this.room.sessionId);
      if (localPlayer) {
        const dx = pointer.worldX - localPlayer.x;
        const dy = pointer.worldY - localPlayer.y;
        const distanceToPointer = Math.hypot(dx, dy);

        if (distanceToPointer > 4) {
          directionX = dx / distanceToPointer;
          directionY = dy / distanceToPointer;
        } else {
          directionX = 0;
          directionY = 0;
        }
      }
    }

    this.checkCollectibleProximity(time);

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

  private checkCollectibleProximity(time: number): void {
    if (!this.room) return;

    const player = this.playerEntities.get(this.room.sessionId);
    if (!player) return;

    for (const [id, collectible] of this.room.state.collectibles) {
      const distance = Math.hypot(
        player.x - collectible.x,
        player.y - collectible.y,
      );

      if (distance <= 56 && time - (this.collectibleAttempts.get(id) ?? -Infinity) >= 300) {
        this.collectibleAttempts.set(id, time);
        this.room.send("collect", { id });
      }
    }
  }
}
