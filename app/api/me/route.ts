import { identity,failure } from "../../../lib/crew-server";
export async function GET(){try{return Response.json(await identity(),{headers:{"Cache-Control":"private, no-store"}});}catch(e){return failure(e);}}
