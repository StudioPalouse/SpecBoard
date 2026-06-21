"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AuthRequiredError, createWorkItem } from "@/lib/api-client";

/**
 * "New {level}" button + drawer for creating a DB-native work item (an
 * initiative/epic — a non-leaf level). Leaf items come from spec sync, so this
 * is only rendered for non-leaf levels. `parents` are the items one level up
 * that the new item may sit under (empty when there's no parent level).
 */
export function WorkItemCreate({
  levelKey,
  levelLabel,
  parentLabel,
  parents,
  productId,
  products,
}: {
  levelKey: string;
  levelLabel: string;
  /** Label of the parent level (e.g. "Initiative"), or null when top-level. */
  parentLabel: string | null;
  parents: { specId: string; title: string; productId?: string | null }[];
  /** Product the new item belongs to; null defers to the default product. */
  productId?: string | null;
  /** Products to choose from in the cross-product ("All products") view, where
   * no single product is in context. Omitted/empty when scoped to a product. */
  products?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Offer a product picker only when no product is in context (all-products
  // view) and there's more than one to choose between.
  const showProductPicker = !productId && (products?.length ?? 0) > 1;
  const [selectedProduct, setSelectedProduct] = useState(
    () => productId ?? products?.[0]?.id ?? null,
  );

  // In the picker, only parents in the chosen product are valid (the server
  // doesn't cross-check, so filtering here keeps the hierarchy single-product).
  const visibleParents = showProductPicker
    ? parents.filter((p) => p.productId === selectedProduct)
    : parents;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    const parentSpecId = String(data.get("parentSpecId") ?? "") || null;
    const chosenProductId = showProductPicker ? selectedProduct : productId;
    startTransition(async () => {
      setError(null);
      try {
        await createWorkItem({
          title,
          level: levelKey,
          parentSpecId,
          productId: chosenProductId,
        });
        toast.success(`${levelLabel} created`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          router.push(
            `/sign-in?from=${encodeURIComponent(window.location.pathname)}`,
          );
          return;
        }
        setError(err instanceof Error ? err.message : "Create failed.");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        New {levelLabel.toLowerCase()}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New {levelLabel.toLowerCase()}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Title
              </span>
              <Input name="title" autoFocus className="h-8" />
            </label>
            {showProductPicker ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Product
                </span>
                <Select
                  value={selectedProduct ?? ""}
                  onChange={(e) => setSelectedProduct(e.target.value || null)}
                  className="h-8"
                >
                  {products!.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            {parentLabel ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Parent ({parentLabel.toLowerCase()})
                </span>
                {/* Remount on product change so a now-invalid parent resets. */}
                <Select
                  key={selectedProduct ?? "all"}
                  name="parentSpecId"
                  defaultValue=""
                  className="h-8"
                >
                  <option value="">None</option>
                  {visibleParents.map((p) => (
                    <option key={p.specId} value={p.specId}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : `Create ${levelLabel.toLowerCase()}`}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
