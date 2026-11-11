import { describe, expect, it } from "vitest";
import { renderOrderEmail } from "@/lib/email";
import type { Order, OrderRevision } from "@/lib/domain";

describe("Portuguese order email", () => {
  it("renders an accepted revision and escapes customer content", () => {
    const order = { order_number: "ENC-20261009-00001", pickup_store: { id: "1", name: "Loja <Centro>", address: "Porto" }, rejection_reason: null } as Order;
    const revision = { version: 2, customer_name: "Ana & Rui", pickup_at: "2026-10-10T10:00:00Z", general_notes: "Sem cebola" } as OrderRevision;
    const rendered = renderOrderEmail("order_updated_accepted", order, revision, [{ product_id: "1", product_name: "Bacalhau", variation_name: "Sem recheio", unit_label: "tab.", quantity: 2 }]);
    expect(rendered.subject).toContain("atualização");
    expect(rendered.html).toContain("Ana &amp; Rui");
    expect(rendered.html).toContain("Loja &lt;Centro&gt;");
    expect(rendered.html).toContain("2 tab.");
    expect(rendered.html).toContain("Bacalhau · Sem recheio");
  });

  it("explains that seasonal orders are confirmed automatically", () => {
    const order = { order_number: "SAZ-20261105-00001", campaign: { id: "1", name: "Natal" }, pickup_store: { id: "1", name: "Loja Centro", address: "Porto" }, rejection_reason: null } as Order;
    const revision = { version: 1, customer_name: "Ana", pickup_at: "2026-11-19T10:00:00Z", general_notes: "" } as OrderRevision;
    const rendered = renderOrderEmail("order_accepted", order, revision, [{ product_id: null, product_name: "Peru", unit_label: "kg", quantity: 2 }]);
    expect(rendered.html).toContain("ficou confirmada automaticamente");
    expect(rendered.html).not.toContain("A cozinha confirmou");
  });

  it("lists the weight of every individual unit", () => {
    const order = { order_number: "SAZ-20261105-00002", pickup_store: { id: "1", name: "Loja Centro", address: "Porto" }, rejection_reason: null } as Order;
    const revision = { version: 1, customer_name: "Ana", pickup_at: "2026-11-19T10:00:00Z", general_notes: "" } as OrderRevision;
    const rendered = renderOrderEmail("order_accepted", order, revision, [{ product_id: null, product_name: "Peru", unit_label: "un.", quantity: 3, unit_weights: [4, 3, 5], unit_weight_label: "kg" }]);
    expect(rendered.html).toContain("3 un. · 4 kg, 3 kg, 5 kg");
  });
});
