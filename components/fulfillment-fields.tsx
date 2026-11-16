"use client";

import { Store, Truck } from "lucide-react";
import type { FulfillmentType } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function FulfillmentFields({ idPrefix, type, address, onTypeChange, onAddressChange, className }: {
  idPrefix: string;
  type: FulfillmentType;
  address: string;
  onTypeChange: (type: FulfillmentType) => void;
  onAddressChange: (address: string) => void;
  className?: string;
}) {
  const addressId = `${idPrefix}-delivery-address`;

  return <FieldSet className={cn("rounded-xl border bg-muted/30 p-4", className)}>
    <FieldLegend>Modalidade de receção</FieldLegend>
    <FieldGroup>
      <ToggleGroup type="single" value={type} onValueChange={(value) => value && onTypeChange(value as FulfillmentType)} variant="outline" spacing={2} className="grid w-full grid-cols-2">
        <ToggleGroupItem value="pickup" className="h-auto min-h-12 whitespace-normal"><Store />Levantamento em loja</ToggleGroupItem>
        <ToggleGroupItem value="delivery" className="h-auto min-h-12 whitespace-normal"><Truck />Entrega em casa</ToggleGroupItem>
      </ToggleGroup>
      {type === "delivery" && <Field>
        <FieldLabel htmlFor={addressId}>Morada de entrega *</FieldLabel>
        <Textarea id={addressId} value={address} onChange={(event) => onAddressChange(event.target.value)} autoComplete="street-address" minLength={5} maxLength={500} required placeholder="Rua, número, andar, código postal e localidade" />
      </Field>}
    </FieldGroup>
  </FieldSet>;
}
