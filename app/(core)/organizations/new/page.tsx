import type { Metadata } from "next";
import { createOrganization } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "New organization",
};

export default function NewOrganizationPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create an organization</CardTitle>
        <CardDescription>
          A shared space for your team. You&apos;ll be its owner and can invite
          people next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createOrganization}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                name="name"
                placeholder="Acme Inc."
                maxLength={100}
                autoComplete="organization"
                required
              />
            </Field>
            <Field>
              <Button type="submit">Create organization</Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
