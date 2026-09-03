import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import type {
  CreateProductPayload,
  Product,
  ProductStatus,
  ProductType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];
const TYPES: ProductType[] = ["physical", "digital", "service"];

interface Props {
  mode: "create" | "edit";
  product?: Product;
  onCreated?: (product: Product) => void;
  onSaved?: () => void;
}

export function ProductDetailsForm({ mode, product, onCreated, onSaved }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? "physical");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload: CreateProductPayload = {
      name: name.trim(),
      description: description.trim(),
      status,
      productType,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      if (mode === "create") {
        const created = await apiClient.createProduct(workspaceId, payload);
        toast.success(`"${created.name}" created.`);
        onCreated?.(created);
      } else if (product) {
        await apiClient.updateProduct(workspaceId, product.id, payload);
        toast.success("Product details saved.");
        onSaved?.();
      }
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
      else setFormError(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">Basics</h2>
          {formError && <Alert variant="danger">{formError}</Alert>}

          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            placeholder="T-Shirt"
          />

          <Field label="Description" error={fieldErrors.description}>
            {({ id }) => (
              <Textarea
                id={id}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Soft cotton tee…"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" error={fieldErrors.status}>
              {({ id }) => (
                <Select
                  id={id}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Type" error={fieldErrors.productType}>
              {({ id }) => (
                <Select
                  id={id}
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <TextField
            label="Tags"
            hint="Comma-separated."
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            error={fieldErrors.tags}
            placeholder="apparel, summer"
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save basics"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
