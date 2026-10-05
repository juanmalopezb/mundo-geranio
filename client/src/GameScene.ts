import Phaser from "phaser";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import { State as GeranioState } from "../../server/src/State";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../../shared/world";

type GameState = GeranioState;

interface MoveMessage {
  x: number;
  y: number;
}

interface PlayerMotion {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  character: string;
  walking: boolean;
  jumping: boolean;
  jumpWalking: boolean;
  idleAnimating: boolean;
  idleTimer?: Phaser.Time.TimerEvent;
  targetX: number;
  targetY: number;
  groundY: number;
}

const GUVU_IDLE_GESTURE_DELAY_MS = 7_000;

export class GameScene extends Phaser.Scene {
  private room?: Room<any, GameState>;
  private background?: Phaser.GameObjects.Image;
  private scoreLabel?: Phaser.GameObjects.Text;
  private jumpButton?: Phaser.GameObjects.Arc;
  private jumpLabel?: Phaser.GameObjects.Text;
  private readonly playerEntities = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly playerShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  private readonly playerMotion = new Map<string, PlayerMotion>();
  private readonly collectibleEntities = new Map<string, Phaser.GameObjects.Container>();
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
    this.load.spritesheet("lili_walk_v2_0", "/assets/lili_walk_atlas_v2_0.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("lili_walk_v2_1", "/assets/lili_walk_atlas_v2_1.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_walk", "/assets/guvu_walk_atlas.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_idle_0", "/assets/guvu_idle_atlas_0.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_idle_1", "/assets/guvu_idle_atlas_1.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_jump_walk_0", "/assets/guvu_jump_walk_atlas_0.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_jump_walk_1", "/assets/guvu_jump_walk_atlas_1.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_jump_idle_0", "/assets/guvu_jump_idle_atlas_0.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.spritesheet("guvu_jump_idle_1", "/assets/guvu_jump_idle_atlas_1.png", {
      frameWidth: 668,
      frameHeight: 377,
    });
    this.load.audio("sonido_gota", "/assets/collect.wav");
  }

  create(): void {
    if (!this.anims.exists("lili-walk-v2")) {
      this.anims.create({
        key: "lili-walk-v2",
        frames: [
          ...this.anims.generateFrameNumbers("lili_walk_v2_0", { start: 0, end: 14 }),
          ...this.anims.generateFrameNumbers("lili_walk_v2_1", { start: 0, end: 5 }),
        ],
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("guvu-walk")) {
      this.anims.create({
        key: "guvu-walk",
        frames: this.anims.generateFrameNumbers("guvu_walk", { start: 0, end: 11 }),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists("guvu-idle")) {
      this.anims.create({
        key: "guvu-idle",
        frames: [
          ...this.anims.generateFrameNumbers("guvu_idle_0", { start: 0, end: 14 }),
          ...this.anims.generateFrameNumbers("guvu_idle_1", { start: 0, end: 14 }),
        ],
        frameRate: 15,
        repeat: 0,
      });
    }
    if (!this.anims.exists("guvu-jump-walk")) {
      this.anims.create({
        key: "guvu-jump-walk",
        frames: [
          ...this.anims.generateFrameNumbers("guvu_jump_walk_0", { start: 0, end: 14 }),
          ...this.anims.generateFrameNumbers("guvu_jump_walk_1", { start: 0, end: 11 }),
        ],
        frameRate: 36,
        repeat: 0,
      });
    }
    if (!this.anims.exists("guvu-jump-idle")) {
      this.anims.create({
        key: "guvu-jump-idle",
        frames: [
          ...this.anims.generateFrameNumbers("guvu_jump_idle_0", { start: 0, end: 14 }),
          ...this.anims.generateFrameNumbers("guvu_jump_idle_1", { start: 0, end: 8 }),
        ],
        frameRate: 36,
        repeat: 0,
      });
    }

    this.cameras.main.setBackgroundColor("#263b2c");
    this.background = this.add.image(0, 0, "fondo").setDepth(-10);
    this.resizeBackground();
    const backgroundBounds = this.background.getBounds();
    this.cameras.main.setBounds(
      backgroundBounds.x,
      backgroundBounds.y,
      backgroundBounds.width,
      backgroundBounds.height,
    );
    this.updateViewportLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.updateViewportLayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.updateViewportLayout, this);
    });

    this.cursors = this.input.keyboard?.createCursorKeys();
    const jumpKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    jumpKey?.on("down", this.requestJump, this);

    // Botón de salto para móvil; permanece anclado a la pantalla.
    this.jumpButton = this.add
      .circle(WORLD_WIDTH - 58, WORLD_HEIGHT - 58, 30, 0x245b45, 0.82)
      .setStrokeStyle(3, 0xd8f5bf, 0.95)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });
    this.jumpLabel = this.add
      .text(this.jumpButton.x, this.jumpButton.y, "↑", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);
    this.jumpButton.on("pointerdown", this.requestJump, this);
    this.jumpButton.on("pointerover", () => this.jumpButton?.setFillStyle(0x347859, 0.95));
    this.jumpButton.on("pointerout", () => this.jumpButton?.setFillStyle(0x245b45, 0.82));
    this.updateViewportLayout();

    const client = new Client(this.getServerUrl());
    void client
      .joinOrCreate<GameState>("geranio_room", {}, GeranioState)
      .then((room) => {
        this.room = room;
        console.info("Conectado a Mundo Geranio:", room.sessionId);

        const callbacks = getStateCallbacks(room);
        callbacks(room.state).players.onAdd((player, sessionId) => {
          const shadow = this.add.ellipse(player.x, player.y + 1, 24, 6, 0x132319, 0.16)
            .setDepth(player.y - 1);
          const sprite = this.add.sprite(player.x, player.y, player.character)
            .setScale(0.18)
            .setOrigin(0.5, 0.72)
            .setDepth(player.y);
          if (player.character === "guvu") {
            sprite.setTexture("guvu_idle_0", 0).setOrigin(0.5, 0.94);
          }

          this.playerEntities.set(sessionId, sprite);
          this.playerShadows.set(sessionId, shadow);
          const motion: PlayerMotion = {
            sprite,
            shadow,
            character: player.character,
            walking: false,
            jumping: false,
            jumpWalking: false,
            idleAnimating: false,
            targetX: player.x,
            targetY: player.y - player.jumpHeight,
            groundY: player.y,
          };
          this.playerMotion.set(sessionId, motion);

          if (motion.character === "guvu") {
            sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
              if (animation.key !== "guvu-idle" || motion.walking || motion.jumping) return;
              motion.idleAnimating = false;
              sprite.setTexture("guvu_idle_0", 0);
              this.scheduleGuvuIdleGesture(motion);
            });
            this.scheduleGuvuIdleGesture(motion);
          }

          if (sessionId === room.sessionId) {
            this.scoreLabel = this.add
              .text(18, 18, `Gotas: ${player.score}`, {
                fontFamily: "Arial, sans-serif",
                fontSize: "20px",
                color: "#ffffff",
                backgroundColor: "#245b45cc",
                padding: { x: 10, y: 7 },
              })
              .setScrollFactor(0)
              .setDepth(110);
            this.updateViewportLayout();
            this.cameras.main.startFollow(sprite, true, 1, 1);
            this.cameras.main.centerOn(sprite.x, sprite.y);
          }

          let previousX = player.x;
          let previousY = player.y;
          let previousScore = player.score;
          callbacks(player).onChange(() => {
            const vx = player.x - previousX;
            const vy = player.y - previousY;
            previousX = player.x;
            previousY = player.y;

            if (motion.character === "guvu") {
              // Los fotogramas de Guvú miran a la derecha de forma nativa.
              if (vx > 0.05) sprite.setFlipX(false);
              else if (vx < -0.05) sprite.setFlipX(true);

              const isWalking = Math.hypot(vx, vy) > 0.15;
              const isJumping = player.jumpHeight > 0;
              this.updateGuvuAnimation(motion, isWalking, isJumping);
            } else if (motion.character === "lili") {
              // Los fotogramas de Lili miran a la derecha de forma nativa.
              if (vx > 0.05) sprite.setFlipX(false);
              else if (vx < -0.05) sprite.setFlipX(true);

              const isWalking = Math.hypot(vx, vy) > 0.15;
              if (isWalking && !motion.walking) {
                sprite.setOrigin(0.5, 0.94).play("lili-walk-v2");
              } else if (!isWalking && motion.walking) {
                sprite.anims.stop();
                sprite.setTexture("lili").setOrigin(0.5, 0.72);
              }
              motion.walking = isWalking;
            } else {
              // Soso conserva su ilustración estática actual.
              if (vx > 0.05) sprite.setFlipX(true);
              else if (vx < -0.05) sprite.setFlipX(false);
            }

            if (player.score !== previousScore) {
              if (sessionId === room.sessionId && player.score > previousScore) {
                this.scoreLabel?.setText(`Gotas: ${player.score}`);
                this.showCollectNotice(sprite);
                this.playCollectSound();
              }
              previousScore = player.score;
            }

            motion.targetX = player.x;
            motion.targetY = player.y - player.jumpHeight;
            motion.groundY = player.y;
            const shadowScale = Phaser.Math.Clamp(1 - player.jumpHeight / 260, 0.48, 1);
            shadow.setScale(shadowScale, shadowScale);
            sprite.setDepth(player.y + 1);
            shadow.setDepth(player.y);
          });
        });

        callbacks(room.state).collectibles.onAdd((collectible, id) => {
          const glow = this.add.circle(0, 0, 18, 0x78dfff, 0.22);
          const droplet = this.add.circle(0, 0, 10, 0x8be7ff, 0.95).setStrokeStyle(2, 0xffffff, 0.9);
          const highlight = this.add.circle(-3, -4, 3, 0xffffff, 0.95);
          const visual = this.add
            .container(collectible.x, collectible.y, [glow, droplet, highlight])
            .setDepth(collectible.y + 2);
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
          this.playerMotion.get(sessionId)?.idleTimer?.remove(false);
          this.playerEntities.get(sessionId)?.destroy();
          this.playerShadows.get(sessionId)?.destroy();
          this.playerEntities.delete(sessionId);
          this.playerShadows.delete(sessionId);
          this.playerMotion.delete(sessionId);
        });

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          void room.leave();
          for (const motion of this.playerMotion.values()) motion.idleTimer?.remove(false);
          this.playerEntities.clear();
          this.playerShadows.clear();
          this.playerMotion.clear();
          this.collectibleEntities.clear();
          this.collectibleAttempts.clear();
        });
      })
      .catch((error: unknown) => {
        console.error("Error al conectar con el servidor Mundo Geranio:", error);
      });
  }

  update(time: number, delta: number): void {
    this.animatePlayers(delta);
    const room = this.room;
    if (!room) return;

    let x = this.cursors ? Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown) : 0;
    let y = this.cursors ? Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown) : 0;
    const zoom = this.cameras.main.zoom;
    const jumpScreenX = (this.jumpButton?.x ?? 0) * zoom;
    const jumpScreenY = (this.jumpButton?.y ?? 0) * zoom;
    const jumpScreenRadius = 34;
    const movementPointer = this.input.manager.pointers.find((pointer) =>
      pointer.isDown &&
      Phaser.Math.Distance.Between(pointer.x, pointer.y, jumpScreenX, jumpScreenY) > jumpScreenRadius,
    );

    if (movementPointer) {
      const localPlayer = room.state.players.get(room.sessionId);
      if (localPlayer) {
        const dx = movementPointer.worldX - localPlayer.x;
        const dy = movementPointer.worldY - localPlayer.y;
        const distance = Math.hypot(dx, dy);
        x = distance > 5 ? dx / distance : 0;
        y = distance > 5 ? dy / distance : 0;
      }
    }

    this.checkCollectibleProximity(time);
    this.sendAccumulator += delta;
    if (this.sendAccumulator < 100) return;
    this.sendAccumulator %= 100;

    const magnitude = Math.hypot(x, y);
    const message: MoveMessage = magnitude > 1
      ? { x: x / magnitude, y: y / magnitude }
      : { x, y };
    room.send("move", message);
  }

  /** Interpola la posición sincronizada sin animar el punto que sigue la cámara. */
  private animatePlayers(delta: number): void {
    const dt = Math.min(delta, 50);
    const blend = 1 - Math.exp(-dt / 75);

    for (const motion of this.playerMotion.values()) {
      const { sprite, shadow } = motion;
      const oldX = sprite.x;
      const oldY = sprite.y;
      const nextX = Phaser.Math.Linear(oldX, motion.targetX, blend);
      const nextY = Phaser.Math.Linear(oldY, motion.targetY, blend);
      sprite.setPosition(nextX, nextY);
      shadow.setPosition(nextX, motion.groundY + 1);
    }
  }

  private requestJump(): void {
    this.room?.send("jump");
  }

  private scheduleGuvuIdleGesture(motion: PlayerMotion): void {
    motion.idleTimer?.remove(false);
    motion.idleTimer = undefined;
    if (motion.walking || motion.jumping || !motion.sprite.active) return;

    motion.idleTimer = this.time.delayedCall(GUVU_IDLE_GESTURE_DELAY_MS, () => {
      motion.idleTimer = undefined;
      if (motion.walking || motion.jumping || !motion.sprite.active) return;
      motion.idleAnimating = true;
      motion.sprite.play("guvu-idle");
    });
  }

  private updateGuvuAnimation(
    motion: PlayerMotion,
    isWalking: boolean,
    isJumping: boolean,
  ): void {
    const sprite = motion.sprite;
    const cancelIdleGesture = (): void => {
      motion.idleTimer?.remove(false);
      motion.idleTimer = undefined;
      motion.idleAnimating = false;
    };

    if (isJumping && !motion.jumping) {
      motion.jumpWalking = motion.walking || isWalking;
      cancelIdleGesture();
      if (motion.jumpWalking) {
        sprite.setOrigin(0.5, 0.94).play("guvu-jump-walk");
      } else {
        sprite.setOrigin(0.5, 0.94).play("guvu-jump-idle");
      }
    } else if (!isJumping && motion.jumping) {
      motion.jumpWalking = false;
      if (isWalking) {
        sprite.setOrigin(0.5, 0.94).play("guvu-walk");
      } else {
        sprite.anims.stop();
        sprite.setTexture("guvu_idle_0", 0);
      }
    } else if (!isJumping) {
      if (isWalking && !motion.walking) {
        cancelIdleGesture();
        // El apoyo de los pies del spritesheet está cerca del borde inferior.
        sprite.setOrigin(0.5, 0.94).play("guvu-walk");
      } else if (!isWalking && motion.walking) {
        sprite.anims.stop();
        sprite.setTexture("guvu_idle_0", 0);
      }

    }

    motion.walking = isWalking;
    motion.jumping = isJumping;
    if (!isWalking && !isJumping && !motion.idleAnimating && !motion.idleTimer) {
      this.scheduleGuvuIdleGesture(motion);
    }
  }

  private getServerUrl(): string {
    const { protocol, hostname } = window.location;
    const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${hostname}:2567`;
  }

  private resizeBackground(): void {
    if (!this.background) return;
    const scale = Math.max(
      WORLD_WIDTH / this.background.width,
      WORLD_HEIGHT / this.background.height,
    );
    this.background
      .setPosition(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)
      .setDisplaySize(this.background.width * scale, this.background.height * scale);
  }

  private updateViewportLayout(): void {
    const zoom = Math.max(
      this.scale.width / WORLD_WIDTH,
      this.scale.height / WORLD_HEIGHT,
    );
    this.cameras.main.setZoom(zoom);

    const localPlayer = this.room?.sessionId
      ? this.playerEntities.get(this.room.sessionId)
      : undefined;
    if (localPlayer) this.cameras.main.centerOn(localPlayer.x, localPlayer.y);

    const inverseZoom = 1 / zoom;
    this.jumpButton
      ?.setPosition((this.scale.width - 54) * inverseZoom, (this.scale.height - 54) * inverseZoom)
      .setScale(inverseZoom);
    this.jumpLabel
      ?.setPosition(this.jumpButton?.x ?? 0, this.jumpButton?.y ?? 0)
      .setScale(inverseZoom);
    this.scoreLabel?.setPosition(16 * inverseZoom, 16 * inverseZoom).setScale(inverseZoom);
  }

  private showCollectNotice(sprite: Phaser.GameObjects.Sprite): void {
    const notice = this.add.text(sprite.x, sprite.y - 48, "+1 gota", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      color: "#e6fbff",
      stroke: "#236b73",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(120);

    this.tweens.add({
      targets: notice,
      y: notice.y - 32,
      alpha: 0,
      duration: 700,
      ease: "Sine.easeOut",
      onComplete: () => notice.destroy(),
    });
  }

  private playCollectSound(): void {
    if (!this.sound.locked) this.sound.play("sonido_gota", { volume: 0.5 });
  }

  private checkCollectibleProximity(time: number): void {
    const room = this.room;
    if (!room) return;
    const player = room.state.players.get(room.sessionId);
    if (!player) return;

    for (const [id, collectible] of room.state.collectibles) {
      const distance = Math.hypot(player.x - collectible.x, player.y - collectible.y);
      if (distance <= 30 && time - (this.collectibleAttempts.get(id) ?? -Infinity) >= 300) {
        this.collectibleAttempts.set(id, time);
        room.send("collect", { id });
      }
    }
  }
}
