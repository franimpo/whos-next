import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "whos_next_voter";

export function getOrCreateVoter(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const voterId = existing || randomUUID();
  const salt = process.env.VOTER_HASH_SALT || "dev-only-change-me";

  const voterHash = createHash("sha256")
    .update(`${salt}:${voterId}`)
    .digest("hex");

  return { voterId, voterHash, isNew: !existing };
}

export function attachVoterCookie(response: NextResponse, voterId: string) {
  response.cookies.set(COOKIE_NAME, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return response;
}
