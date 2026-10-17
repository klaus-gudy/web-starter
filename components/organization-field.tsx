"use client"

import { useSearchParams } from "next/navigation"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// The organization a new account creates. Left out for someone signing up
// from an invitation link, who joins that organization instead. Render inside
// <Suspense>, since it reads the URL.
export function OrganizationField() {
  if (useSearchParams().get("next")?.startsWith("/invite/")) return null

  return (
    <Field>
      <FieldLabel htmlFor="organization">Organization</FieldLabel>
      <Input
        id="organization"
        name="organization"
        autoComplete="organization"
        placeholder="Acme Inc."
        maxLength={100}
        required
      />
      <FieldDescription>You&apos;ll be its owner and can invite your team.</FieldDescription>
    </Field>
  )
}
