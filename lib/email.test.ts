import { describe, expect, it } from "vitest";
import { renderOrderEmail } from "@/lib/email";
import type { Order, OrderRevision } from "@/lib/domain";

describe("Portuguese order email", () => {
  it("renders an accepted revision and escapes customer content", () => {
    const order = { order_number: "ENC-20261009-00001", pickup_store: { id: "1", name: "Loja <Centro>", address: "Porto" }, rejection_reason: null } as Order;
    const revision = { version: 2, customer_name: "Ana & Rui", pickup_at: "2026-10-10T10:00:00Z", general_notes: "Sem cebola" } as OrderRevision;
    const rendered = renderOrderEmail("order_updated_accepted", order, revision, [{ product_id: "1", product_name: "Bacalhau", unit_label: "tab.", quantity: 2 }]);
    expect(rendered.subject).toContain("atualização");
    expect(rendered.html).toContain("Ana &amp; Rui");
    expect(rendered.html).toContain("Loja &lt;Centro&gt;");
    expect(rendered.html).toContain("2 tab.");
  });
});
