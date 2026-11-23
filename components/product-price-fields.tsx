"use client";

import { useMemo } from "react";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function parsedVariations(value: string) {
  return [...new Set(value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))];
}

export function ProductPriceFields({
  idPrefix,
  variations,
  onVariationsChange,
  unitPriceCents = null,
  variationPricesCents = {},
  className,
}: {
  idPrefix: string;
  variations: string;
  onVariationsChange: (value: string) => void;
  unitPriceCents?: number | null;
  variationPricesCents?: Record<string, number | null>;
  className?: string;
}) {
  const options = useMemo(() => parsedVariations(variations), [variations]);

  return <>
    <Field className={className}>
      <FieldLabel htmlFor={`${idPrefix}-variations`}>Opções / variações (uma por linha)</FieldLabel>
      <Textarea id={`${idPrefix}-variations`} name="variations" value={variations} onChange={(event) => onVariationsChange(event.target.value)} placeholder={"Pequeno\nGrande\n\nou\n\nCom recheio\nSem recheio"} />
    </Field>
    {options.length ? <FieldSet className={className}>
      <FieldLegend>Preços por variação (€)</FieldLegend>
      <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
        {options.map((variation, index) => <Field key={variation}>
          <FieldLabel htmlFor={`${idPrefix}-variation-price-${index}`}>{variation}</FieldLabel>
          <Input id={`${idPrefix}-variation-price-${index}`} name="variation_price" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" defaultValue={variationPricesCents[variation] === null || variationPricesCents[variation] === undefined ? "" : variationPricesCents[variation] / 100} placeholder="Sem preço" />
        </Field>)}
      </FieldGroup>
    </FieldSet> : <Field className={className}>
      <FieldLabel htmlFor={`${idPrefix}-unit-price`}>Preço por unidade / peso (€)</FieldLabel>
      <Input id={`${idPrefix}-unit-price`} name="unit_price" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" defaultValue={unitPriceCents === null ? "" : unitPriceCents / 100} placeholder="Sem preço" />
    </Field>}
  </>;
}
