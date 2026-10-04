import { Room, Client } from "colyseus";
import { State, Player } from "./State";

// Al poner <any, any> le decimos a TypeScript que deje de auditar 
// los genéricos internos de Colyseus y nos deje trabajar.
export class GeranioRoom extends Room<any, any> {
    maxClients = 4;

    onCreate (options: any) {
        this.setState(new State());

        // Escucha las pulsaciones de flechas que envía Phaser
        this.onMessage("move", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.x += data.x;
                player.y += data.y;
            }
        });
    }

    onJoin (client: Client, options: any) {
        console.log("🟢 ¡Jugador conectado! ID:", client.sessionId);
        
        const player = new Player();
        // El servidor no sabe qué tamaño de pantalla tiene la tablet, 
        // así que los hacemos nacer en el centro de tu lienzo (coordenadas 400x, 300y)
        player.x = 400; 
        player.y = 300;
        
        this.state.players.set(client.sessionId, player);
    }

    onLeave (client: Client, consented: boolean) {
        console.log("🔴 Jugador desconectado:", client.sessionId);
        this.state.players.delete(client.sessionId);
    }
}