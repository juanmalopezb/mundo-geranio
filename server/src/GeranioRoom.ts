import { Room, Client } from "colyseus";
import { State, Player, Collectible } from "./State";
import { beginJump, isWalkable, stepMotion, type MovementInput } from "../../shared/world";

interface PlayerMotion {
    vx: number;
    vy: number;
    jumpVelocity: number;
}

// Al poner <any, any> le decimos a TypeScript que deje de auditar 
// los genéricos internos de Colyseus y nos deje trabajar.
export class GeranioRoom extends Room<{ state: State }> {
    maxClients = 4;
    private collectibleSequence = 0;
    private readonly playerInputs = new Map<string, MovementInput>();
    private readonly inputUpdatedAt = new Map<string, number>();
    private readonly motions = new Map<string, PlayerMotion>();

    onCreate (options: any): void {
        this.setState(new State());

        for (let index = 0; index < 12; index += 1) {
            this.spawnCollectible();
        }

        this.onMessage<MovementInput>("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !Number.isFinite(data?.x) || !Number.isFinite(data?.y)) return;
            const length = Math.hypot(data.x, data.y);
            const scale = length > 1 ? 1 / length : 1;
            this.playerInputs.set(client.sessionId, { x: data.x * scale, y: data.y * scale });
            this.inputUpdatedAt.set(client.sessionId, Date.now());
        });

        this.onMessage("jump", (client) => {
            const player = this.state.players.get(client.sessionId);
            const motion = this.motions.get(client.sessionId);
            if (player && motion) {
                const jumpState = {
                    jumpHeight: player.jumpHeight,
                    jumpVelocity: motion.jumpVelocity,
                };
                beginJump(jumpState);
                motion.jumpVelocity = jumpState.jumpVelocity;
            }
        });

        this.onMessage<{ id: string }>("collect", (client, message) => {
            if (typeof message?.id === "string") {
                this.collectCollectible(client, message.id);
            }
        });

        this.setSimulationInterval(() => this.simulate(), 1000 / 30);
    }

    private simulate(): void {
        const deltaSeconds = 1 / 30;
        for (const [sessionId, player] of this.state.players) {
            const motion = this.motions.get(sessionId);
            if (!motion) continue;

            const next = {
                x: player.x,
                y: player.y,
                jumpHeight: player.jumpHeight,
                ...motion,
            };
            const inputIsFresh = Date.now() - (this.inputUpdatedAt.get(sessionId) ?? 0) <= 250;
            const input = inputIsFresh
                ? this.playerInputs.get(sessionId) ?? { x: 0, y: 0 }
                : { x: 0, y: 0 };
            stepMotion(next, input, deltaSeconds);
            player.x = next.x;
            player.y = next.y;
            player.jumpHeight = next.jumpHeight;
            motion.vx = next.vx;
            motion.vy = next.vy;
            motion.jumpVelocity = next.jumpVelocity;

            for (const [id, collectible] of Array.from(this.state.collectibles.entries())) {
                if (Math.hypot(player.x - collectible.x, player.y - collectible.y) <= 30) {
                    const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
                    if (client) this.collectCollectible(client, id);
                }
            }
        }
    }

    private collectCollectible(client: Client, id: string): void {
        const player = this.state.players.get(client.sessionId);
        const collectible = this.state.collectibles.get(id);
        if (!player || !collectible) return;

        const distance = Math.hypot(player.x - collectible.x, player.y - collectible.y);
        if (distance > 56) return;

        this.state.collectibles.delete(id);
        player.score += 1;
        this.spawnCollectible(player.x, player.y);
    }

    private spawnCollectible(avoidX?: number, avoidY?: number): void {
        const collectible = new Collectible();
        const existing = Array.from(this.state.collectibles.values());
        let x = 400;
        let y = 300;

        for (let attempt = 0; attempt < 120; attempt += 1) {
            x = 15 + Math.random() * 770;
            y = 180 + Math.random() * 205;

            const farFromCollector =
                avoidX === undefined ||
                avoidY === undefined ||
                Math.hypot(x - avoidX, y - avoidY) >= 120;
            const spacedFromOthers = existing.every(
                (item) => Math.hypot(x - item.x, y - item.y) >= 42,
            );

            if (farFromCollector && spacedFromOthers && isWalkable(x, y)) break;
            x = 400;
            y = 300;
        }

        collectible.x = x;
        collectible.y = y;
        this.state.collectibles.set(`dew-${this.collectibleSequence++}`, collectible);
    }

    onJoin (client: Client, options: any): void {
        console.log("🟢 ¡Jugador conectado! ID:", client.sessionId);
        
        const player = new Player();
        const spawn = this.findPlayerSpawn();
        player.x = spawn.x;
        player.y = spawn.y;
        player.jumpHeight = 0;
        const characters = ["soso", "lili", "guvu"] as const;
        player.character =
            characters[Math.floor(Math.random() * characters.length)] ?? "soso";
        
        this.state.players.set(client.sessionId, player);
        this.playerInputs.set(client.sessionId, { x: 0, y: 0 });
        this.inputUpdatedAt.set(client.sessionId, Date.now());
        this.motions.set(client.sessionId, { vx: 0, vy: 0, jumpVelocity: 0 });
    }

    onLeave (client: Client, code?: number): void {
        console.log("🔴 Jugador desconectado:", client.sessionId);
        this.state.players.delete(client.sessionId);
        this.playerInputs.delete(client.sessionId);
        this.inputUpdatedAt.delete(client.sessionId);
        this.motions.delete(client.sessionId);
    }

    private findPlayerSpawn(): { x: number; y: number } {
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const x = 260 + Math.random() * 280;
            const y = 260 + Math.random() * 100;
            const clearOfPlayers = Array.from(this.state.players.values()).every(
                (player) => Math.hypot(player.x - x, player.y - y) >= 64,
            );
            if (clearOfPlayers && isWalkable(x, y)) return { x, y };
        }
        return { x: 400, y: 300 };
    }
}
