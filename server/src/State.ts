import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") jumpHeight: number = 0;
    @type("string") character: string = "soso";
    @type("number") score: number = 0;
}

export class Collectible extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
}

export class State extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Collectible }) collectibles = new MapSchema<Collectible>();
}
