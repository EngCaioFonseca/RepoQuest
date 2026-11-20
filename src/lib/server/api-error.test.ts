import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "./api-error";

const schema = z.object({ name: z.string().min(1) });
const post = (body: string) => new Request("http://localhost/x", { method: "POST", body });

describe("parseJsonBody", () => {
  it("returns parsed data for a valid body", async () => {
    expect(await parseJsonBody(post('{"name":"a"}'), schema, "Bad.")).toEqual({ data: { name: "a" } });
  });

  it("returns 400 invalid_json for malformed JSON", async () => {
    const result = await parseJsonBody(post("{"), schema, "Bad.");
    if (!("response" in result)) throw new Error("expected response");
    expect(result.response.status).toBe(400);
    expect((await result.response.json()).error.code).toBe("invalid_json");
  });

  it("returns 400 invalid_request with per-field messages", async () => {
    const result = await parseJsonBody(post('{"name":""}'), schema, "Bad.");
    if (!("response" in result)) throw new Error("expected response");
    const body = await result.response.json();
    expect(result.response.status).toBe(400);
    expect(body.error).toMatchObject({ code: "invalid_request", message: "Bad." });
    expect(Object.keys(body.error.fields)).toEqual(["name"]);
  });
});
