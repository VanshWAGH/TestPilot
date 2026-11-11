import type { TestTemplate } from "@testpilot/shared";

export const crudTemplate: TestTemplate = {
  id: "crud",
  name: "CRUD Lifecycle Flow",
  category: "crud",
  description:
    "Complete Create, Read, Update, and Delete entity lifecycle test template with table filtering, modal confirmations, and state assertions.",
  tags: ["crud", "create", "read", "update", "delete", "table", "list", "management", "entity"],
  explanation:
    "Tests the full state lifecycle of domain resources, ensuring records can be inserted, queried, modified, and pruned with UI feedback.",
  templateCode: `import { test, expect } from '@playwright/test';
import { ItemListPage } from '../pages/item-list.page';
import { ItemEditorPage } from '../pages/item-editor.page';

test.describe('Entity Management - Complete CRUD Lifecycle', () => {
  let listPage: ItemListPage;
  let editorPage: ItemEditorPage;
  const uniqueName = \`Test Item \${Date.now()}\`;

  test.beforeEach(async ({ page }) => {
    listPage = new ItemListPage(page);
    editorPage = new ItemEditorPage(page);
    await listPage.goto();
  });

  test('should create a new entity and display it in the list view', async () => {
    // 1. Open create modal / page
    await listPage.clickCreateNew();
    await expect(editorPage.modalTitle).toBeVisible();

    // 2. Populate form fields
    await editorPage.fillName(uniqueName);
    await editorPage.fillDescription('Automated test entity created via Playwright');
    await editorPage.selectCategory('Standard');

    // 3. Save entity
    await editorPage.submitSave();
    await expect(editorPage.successToast).toBeVisible();

    // 4. Verify entity appears in table
    await listPage.search(uniqueName);
    const row = listPage.getItemRow(uniqueName);
    await expect(row).toBeVisible();
  });

  test('should inspect details of an existing entity', async () => {
    await listPage.search(uniqueName);
    const row = listPage.getItemRow(uniqueName);
    await expect(row).toBeVisible();

    await listPage.clickItemDetails(uniqueName);
    await expect(editorPage.nameDisplay).toContainText(uniqueName);
  });

  test('should update attributes of an existing entity and persist changes', async () => {
    const updatedName = \`\${uniqueName} (Updated)\`;

    await listPage.search(uniqueName);
    await listPage.clickEdit(uniqueName);

    await editorPage.fillName(updatedName);
    await editorPage.submitSave();
    await expect(editorPage.successToast).toBeVisible();

    // Verify updated title in table
    await listPage.search(updatedName);
    await expect(listPage.getItemRow(updatedName)).toBeVisible();
  });

  test('should delete an entity with confirmation and remove it from list', async () => {
    const updatedName = \`\${uniqueName} (Updated)\`;

    await listPage.search(updatedName);
    await listPage.clickDelete(updatedName);

    // Confirm deletion in alert dialog
    await listPage.confirmDeleteDialog();
    await expect(listPage.successToast).toBeVisible();

    // Assert row no longer exists
    await listPage.search(updatedName);
    await expect(listPage.emptyStatePlaceholder).toBeVisible();
    await expect(listPage.getItemRow(updatedName)).toHaveCount(0);
  });
});
`,
};

