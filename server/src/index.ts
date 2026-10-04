import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport"; // <--- Esta es la clave nueva
// Asegúrate de que el nombre coincide con tu archivo
import { GeranioRoom } from "./GeranioRoom"; 

const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);

// Ahora usamos el WebSocketTransport como exige la nueva versión
const gameServer = new Server({
    transport: new WebSocketTransport({
        server: server
    })
});

gameServer.define('geranio_room', GeranioRoom);

gameServer.listen(2567);
console.log("🌿 Servidor de Mundo Geranio escuchando en el puerto 2567");