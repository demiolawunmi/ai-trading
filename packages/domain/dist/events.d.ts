import type { OrderSide, Venue } from "./contracts";
export type FillPartial = {
    type: "FillPartial";
    payload: {
        venue: Venue;
        symbol: string;
        side: OrderSide;
        quantity: number;
        price: number;
    };
};
export type FillComplete = {
    type: "FillComplete";
    payload: {
        venue: Venue;
        symbol: string;
        side: OrderSide;
        quantity: number;
        averagePrice: number;
    };
};
