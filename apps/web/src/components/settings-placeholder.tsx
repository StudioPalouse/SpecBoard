import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** A "coming soon" panel for Settings areas that aren't built yet. */
export function SettingsPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This area is coming soon.
      </CardContent>
    </Card>
  );
}
