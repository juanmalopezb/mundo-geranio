import { Room, Client } from "colyseus";
import { State, Player, Collectible } from "./State";

// Al poner <any, any> le decimos a TypeScript que deje de auditar 
// los genéricos internos de Colyseus y nos deje trabajar.
export class GeranioRoom extends Room<{ state: State }> {
    maxClients = 4;
    private collectibleSequence = 0;

    onCreate (options: any): void {
        this.setState(new State());

        for (let index = 0; index < 12; index += 1) {
            this.spawnCollectible();
        }

        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !Number.isFinite(data?.x) || !Number.isFinite(data?.y)) return;

            const moveLength = Math.hypot(data.x, data.y);
            const moveScale = moveLength > 40 ? 40 / moveLength : 1;
            player.x += data.x * moveScale;
            player.y += data.y * moveScale;

            for (const [id] of Array.from(this.state.collectibles.entries())) {
                this.collectCollectible(client, id);
            }
        });

        this.onMessage<{ id: string }>("collect", (client, message) => {
            if (typeof message?.id === "string") {
                this.collectCollectible(client, message.id);
            }
        });
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
        let x = 140;
        let y = 120;

        for (let attempt = 0; attempt < 40; attempt += 1) {
            x = 140 + Math.random() * 520;
            y = 120 + Math.random() * 360;

            const farFromCollector =
                avoidX === undefined ||
                avoidY === undefined ||
                Math.hypot(x - avoidX, y - avoidY) >= 120;
            const spacedFromOthers = existing.every(
                (item) => Math.hypot(x - item.x, y - item.y) >= 42,
            );

            if (farFromCollector && spacedFromOthers) break;
        }

        collectible.x = x;
        collectible.y = y;
        this.state.collectibles.set(`dew-${this.collectibleSequence++}`, collectible);
    }

    onJoin (client: Client, options: any): void {
        console.log("🟢 ¡Jugador conectado! ID:", client.sessionId);
        
        const player = new Player();
        // El servidor no sabe qué tamaño de pantalla tiene la tablet, 
        // así que los hacemos nacer en el centro de tu lienzo (coordenadas 400x, 300y)
        player.x = 400; 
        player.y = 300;
        const characters = ["soso", "lili", "guvu"] as const;
        player.character =
            characters[Math.floor(Math.random() * characters.length)] ?? "soso";
        
        this.state.players.set(client.sessionId, player);
    }

    onLeave (client: Client, code?: number): void {
        console.log("🔴 Jugador desconectado:", client.sessionId);
        this.state.players.delete(client.sessionId);
    }
}
