import { expect, test } from '@playwright/test';

/**
 * El recorrido básico en un navegador real: si algo entre la web, la API y la BD se rompe
 * (rutas, cookie de sesión, permisos, cálculo del avance), esta prueba lo detecta antes de que
 * la fusión a main se despliegue.
 */
test('iniciar sesión, crear un elemento con una actividad, terminarla y ver el avance', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Contraseña', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // Directo al primer espacio (Mi aprendizaje, creado con el primer Admin)
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]+$/);

  await page.getByRole('link', { name: 'Elementos' }).first().click();
  await page.getByRole('link', { name: 'Nuevo elemento' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Curso de TypeScript');
  await page.getByRole('button', { name: 'Crear elemento' }).click();
  // Al crearlo se abre su ficha
  await expect(page.getByRole('heading', { name: 'Curso de TypeScript' })).toBeVisible();

  // La ficha del elemento también tiene un campo Nombre: cada paso se busca dentro de su formulario
  const formWith = (button: string) =>
    page.locator('form').filter({ has: page.getByRole('button', { name: button }) });

  await page.getByRole('button', { name: 'Actividad', exact: true }).click();
  const newActivity = formWith('Agregar actividad');
  await newActivity.getByLabel('Nombre', { exact: true }).fill('Ver la introducción');
  await newActivity.getByRole('button', { name: 'Agregar actividad' }).click();

  const progress = page.getByRole('progressbar', { name: 'Avance del elemento' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page.getByRole('button', { name: 'Editar Ver la introducción' }).click();
  const editActivity = formWith('Guardar actividad');
  await editActivity.getByLabel('Estado', { exact: true }).selectOption({ label: 'Hecha' });
  await editActivity.getByRole('button', { name: 'Guardar actividad' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '100');

  // La lista de elementos muestra el mismo avance
  await page.getByRole('link', { name: 'Elementos' }).first().click();
  await expect(
    page.getByRole('progressbar', { name: 'Avance de Curso de TypeScript' }),
  ).toHaveAttribute('aria-valuenow', '100');
});
