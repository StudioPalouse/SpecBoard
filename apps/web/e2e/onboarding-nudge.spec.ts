import { expect, test } from "@playwright/test";

import { getWorkspace, resetBoard } from "./helpers/db";
import { resetFixture } from "./helpers/github";

test.describe("onboarding: dedicated spec-repo nudge", () => {
  test("offers a prefilled GitHub new-repo link when nothing is connected", async ({ page }) => {
    const ws = await getWorkspace();
    await resetBoard(ws.id); // no connected repos
    resetFixture();

    await page.goto(`/${ws.slug}/settings/repositories`);

    // The nudge is a collapsed <details>; its summary is visible up front.
    const summary = page.getByText("Prefer a dedicated repo just for specs?");
    await expect(summary).toBeVisible();
    await summary.click();

    const createLink = page.getByRole("link", { name: /Create a repo on GitHub/i });
    await expect(createLink).toBeVisible();
    await expect(createLink).toHaveAttribute("href", /github\.com\/new\?name=specs/);
  });
});
