import { NextResponse } from "next/server";
import { DatabaseError } from "./database";

export function storageResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof DatabaseError ? error.message : "Baza de date nu este disponibilă. Reîncercați." }, { status: 503 });
}
