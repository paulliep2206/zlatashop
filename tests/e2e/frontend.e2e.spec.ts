import path from 'path'
import { test, expect, Page } from '@playwright/test'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

test.describe('Frontend', () => {
  let page: Page
  const baseURL = 'http://localhost:3000'
  const mediaURL = `${baseURL}/admin/collections/media`
  const adminEmail = 'admin@test.com'
  const adminPassword = 'admin'
  const userEmail = 'user@test.com'
  const userPassword = 'user'
  test.beforeAll(async ({ browser, request }, testInfo) => {
    const context = await browser.newContext()
    page = await context.newPage()
    await createUserAndLogin(request, adminEmail, adminPassword)
    await createVariantsAndProducts(page, request)
  })

  test('can go on homepage', async ({ page }) => {
    await page.goto(baseURL)

    await expect(page).toHaveTitle(/Payload Ecommerce Template/)

    const heading = page.locator('h1').first()

    await expect(heading).toHaveText('Payload Ecommerce Template')
  })

  test('can sign up and subsequently login', async ({ page }) => {
    await logoutAndExpectSuccess(page)

    await page.goto(`${baseURL}/create-account`)

    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const confirmPasswordInput = page.locator('input[name="passwordConfirm"]')
    const email = `test-${Date.now()}@test.com`
    const password = `test`

    await emailInput.fill(email)
    await passwordInput.fill(password)
    await confirmPasswordInput.fill(password)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    const successMessage = page.locator('text=Account created successfully')
    await expect(successMessage).toBeVisible()

    await logoutAndExpectSuccess(page)
    await loginFromUI(page, email, password)
  })

  test('can add products to cart', async ({ page }) => {
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })
  })

  test('can add product with variant to cart', async ({ page }) => {
    await addToCartAndConfirm(page, {
      productName: 'Test Product With Variants',
      productSlug: 'test-product-variants',
      variant: 'Test Product — Payload',
    })
  })

  test('can remove products from cart', async ({ page }) => {
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })

    await removeFromCartAndConfirm(page)
  })

  test('can remove products with variants from cart', async ({ page }) => {
    await addToCartAndConfirm(page, {
      productName: 'Test Product With Variants',
      productSlug: 'test-product-variants',
      variant: 'Test Product — Payload',
    })

    await removeFromCartAndConfirm(page)
  })

  test('should retain cart content on hard refresh', async ({ page }) => {
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })

    await page.reload()

    const cartCount = page.locator('button[data-slot="sheet-trigger"] span').last()
    await cartCount.click()

    const productInCart = page.getByRole('dialog').getByText('Test Product')
    await expect(productInCart).toBeVisible()
  })

  test('can view and sort via search page', async ({ page }) => {
    await page.goto(`${baseURL}/search`)

    const productCard = page.locator(`a[href="/products/test-product"]`)
    await productCard.waitFor({ state: 'visible' })
    await expect(productCard).toBeVisible()

    const firstCard = page.locator('div.grid > a').first()
    const title = firstCard.locator('div.font-mono > div').first()
    await expect(title).not.toHaveText('Hoodie')

    const priceSort = page.getByText('Price: Low to high')
    await priceSort.click()
    await expect(page).toHaveURL(/\/search\?sort=price/)

    await expect(title).toHaveText('Hoodie')
  })

  test('authenticated users can view account', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    await page.goto(`${baseURL}/account`)

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Account settings')
  })

  test('authenticated users can update their name', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    await page.goto(`${baseURL}/account`)

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Account settings')

    const nameInput = page.locator('input[name="name"]')
    const newName = `Test User`
    await nameInput.fill(newName)

    const updateButton = await page.getByRole('button', { name: 'Update Account' })
    await updateButton.click()

    const successMessage = page.locator('text=Successfully updated account')
    await expect(successMessage).toBeVisible()
  })

  test('authenticated users can view orders page', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    await page.goto(`${baseURL}/orders`)

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Orders')
  })

  test.skip('authenticated users can view order details through WayForPay', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })

    await checkoutWithWayForPaySandbox(page)

    await expectOrderIsDisplayed(page)
  })

  test('authenticated customers cannot access /admin', async ({ page }) => {
    await createUserAndLogin(page.request, userEmail, userPassword, false)
    await page.goto(`${baseURL}/admin`)
    const heading = page.locator('h1').first()
    await expect(heading).toContainText('Unauthorized')
  })

  test.skip('Guest can create and view a WayForPay order', async ({ page }) => {
    await logoutAndExpectSuccess(page)
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })

    await checkoutWithWayForPaySandbox(page, 'guest@test.com')
    await expectOrderIsDisplayed(page)
  })

  test.skip('Guest can view their WayForPay order using /find-order', async ({ page }) => {
    await logoutAndExpectSuccess(page)
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })

    const guestEmail = 'guest@test.com'

    await checkoutWithWayForPaySandbox(page, guestEmail)

    const orderHeader = await page.locator('h1.text-sm.uppercase.font-mono > span').textContent()
    const orderNumber = orderHeader?.replace(/^Order #/, '').trim()

    await page.goto(`${baseURL}/find-order`)
    const orderNumberInput = page.locator('input[name="orderID"]')
    const emailInput = page.locator('input[name="email"]')
    await orderNumberInput.fill(orderNumber || '')
    await emailInput.fill(guestEmail)

    const findOrderButton = page.getByRole('button', { name: 'Find my order' })
    await findOrderButton.click()

    await expect(orderHeader).not.toBeNull()
  })

  test('Admins can update and view prices on products', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    await page.goto(`${baseURL}/admin/collections/products`)
    const testProductLink = page.getByRole('link', { name: 'Test Product', exact: true })
    await testProductLink.click()

    const productDetailsButton = page.getByRole('button', { name: 'Product Details' })
    await productDetailsButton.click()

    const priceInput = page.locator('input.formattedPriceInput[placeholder="0.00"]')
    await priceInput.fill('20.00')

    await saveAndConfirmSuccess(page)
  })

  test('Admins can update prices on products used as variants', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    await page.goto(`${baseURL}/admin/collections/products`)
    const testProductWithVariantsLink = page.getByRole('link', {
      name: 'Test Product With Variants — Payload',
      exact: true,
    })
    await testProductWithVariantsLink.click()

    const variantPriceInput = page.locator('input#field-price')
    await variantPriceInput.fill('2500')

    await saveAndConfirmSuccess(page)
  })

  test.skip('Admins can view WayForPay payments and orders', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)
    await addToCartAndConfirm(page, {
      productName: 'Test Product',
      productSlug: 'test-product',
    })
    await checkoutWithWayForPaySandbox(page)
    await expectOrderIsDisplayed(page)
    const orderHeader = await page.locator('h1.text-sm.uppercase.font-mono > span').textContent()
    const orderNumber = orderHeader?.replace(/^Order #/, '').trim()

    await page.goto(`${baseURL}/admin/collections/orders`)
    const rowCount = await page.locator('div.table table tbody tr').count()
    expect(rowCount).toBeGreaterThan(1)

    await page.goto(`${baseURL}/admin/collections/orders/${orderNumber}`)
    const product = page.locator('div.rs__control', { hasText: 'Test Product' })
    await expect(product).toBeVisible()

    await page.goto(`${baseURL}/admin/collections/wayforpay-payments`)
    const transactionRows = await page.locator('div.table table tbody tr').count()
    expect(transactionRows).toBeGreaterThan(0)

    const firstRow = page.locator('td.cell-createdAt > a').first()
    await firstRow.click()

    const status = page.locator('div.rs__control', { hasText: 'Succeeded' })
    await expect(status).toBeVisible()
  })

  test('should disable add to cart when product has no inventory', async ({ page }) => {
    await page.goto(`${baseURL}/products/no-inventory-product`)
    const addToCartButton = page.getByRole('button', { name: 'Add to Cart' })
    await expect(addToCartButton).toBeDisabled()
  })

  // This test fails, it should not let you checkout but it does
  test.skip('should fail checkout when inventory is 0', async ({ page }) => {
    await loginFromUI(page, adminEmail, adminPassword)

    // update inventory to 1
    await page.goto(`${baseURL}/admin/collections/products`)
    const testProductLink = page.getByRole('link', { name: 'No Inventory Product', exact: true })
    await testProductLink.click()
    const productDetailsButton = page.getByRole('button', { name: 'Product Details' })
    await productDetailsButton.click()
    const inventoryInput = page.locator('input[name="stock"]')
    await inventoryInput.fill('1')
    await saveAndConfirmSuccess(page)

    await page.goto(`${baseURL}/products/no-inventory-product`)
    const addToCartButton = page.getByRole('button', { name: 'Add to Cart' })
    await expect(addToCartButton).toBeVisible()
    await addToCartButton.click()

    // update inventory to 0
    await page.goto(`${baseURL}/admin/collections/products`)
    await testProductLink.click()
    await productDetailsButton.click()
    await inventoryInput.fill('')
    await saveAndConfirmSuccess(page)

    await checkoutWithWayForPaySandbox(page)
    const errorMessage = page.locator('text=This product is out of stock')
    await expect(errorMessage).toBeVisible()
  })

  async function createUserAndLogin(
    request: any,
    email: string,
    password: string,
    isAdmin: boolean = true,
  ) {
    const data: any = {
      email,
      password,
    }

    if (isAdmin) {
      data.roles = ['admin']
    }

    const response = await request.post(`${baseURL}/api/users`, {
      data,
    })

    console.log({ response })

    const login = await request.post(`${baseURL}/api/users/login`, {
      data: {
        email,
        password,
      },
    })

    console.log({ login })
  }

  async function createVariantsAndProducts(page: Page, request: any) {
    await loginFromUI(page, adminEmail, adminPassword)
    await page.goto(`${mediaURL}/create`)
    const fileInput = page.locator('input[type="file"]')
    const altInput = page.locator('input[name="alt"]')
    const filePath = path.resolve(dirname, '../../public/media/image-post1.webp')
    await fileInput.setInputFiles(filePath)
    await altInput.fill('Test Image')
    const uploadButton = page.locator('#action-save')
    await uploadButton.click()
    const successMessage = page.locator('text=Media successfully created')
    await expect(successMessage).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/collections\/media\/\d+/)
    const imageID = page.url().split('/').pop()

    const payloadVariant = await request.post(`${baseURL}/api/products`, {
      data: {
        title: 'Test Product With Variants — Payload',
        slug: 'test-product-variant-payload',
        sku: 'test-product-variant-payload',
        productType: 'simple',
        price: 1000,
        stockStatus: 'in_stock',
        stock: 50,
        _status: 'published',
        gallery: [{ image: imageID }],
      },
    })
    const figmaVariant = await request.post(`${baseURL}/api/products`, {
      data: {
        title: 'Test Product With Variants — Figma',
        slug: 'test-product-variant-figma',
        sku: 'test-product-variant-figma',
        productType: 'simple',
        price: 1000,
        stockStatus: 'in_stock',
        stock: 50,
        _status: 'published',
        gallery: [{ image: imageID }],
      },
    })
    const payloadVariantID = (await payloadVariant.json()).doc.id
    const figmaVariantID = (await figmaVariant.json()).doc.id
    await request.post(`${baseURL}/api/products`, {
      data: {
        title: 'Test Product With Variants',
        slug: 'test-product-variants',
        sku: 'test-product-variants',
        productType: 'configurable',
        variants: [payloadVariantID, figmaVariantID],
        price: 1000,
        stockStatus: 'in_stock',
        stock: 0,
        _status: 'published',
        gallery: [{ image: imageID }],
      },
    })

    const product = await request.post(`${baseURL}/api/products`, {
      data: {
        title: 'Test Product',
        slug: 'test-product',
        sku: 'test-product',
        productType: 'simple',
        price: 1000,
        stockStatus: 'in_stock',
        stock: 100,
        _status: 'published',
        gallery: [{ image: imageID }],
      },
    })

    const noInventoryProduct = await request.post(`${baseURL}/api/products`, {
      data: {
        title: 'No Inventory Product',
        slug: 'no-inventory-product',
        sku: 'no-inventory-product',
        productType: 'simple',
        price: 1000,
        stockStatus: 'out_stock',
        stock: 0,
        _status: 'published',
        gallery: [{ image: imageID }],
      },
    })
  }

  async function logoutAndExpectSuccess(page: Page) {
    await page.goto(`${baseURL}/logout`)
    const heading = page.locator('h1').first()
    await expect(heading).toContainText(/logged out/i)
  }

  async function loginFromUI(page: Page, email: string, password: string) {
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.locator('button[type="submit"]')

    await page.goto(`${baseURL}/login`)
    await emailInput.fill(email)
    await passwordInput.fill(password)
    await submitButton.click()
    await page.waitForURL(/\/account/)
  }

  async function addToCartAndConfirm(
    page: Page,
    {
      productName,
      productSlug,
      variant,
    }: {
      productName: string
      productSlug: string
      variant?: string
    },
  ) {
    await page.goto(`${baseURL}/shop`)
    await expect(page).toHaveURL(/\/shop/)

    const productCard = page.locator(`a[href="/products/${productSlug}"]`).first()
    await productCard.waitFor({ state: 'visible' })
    await productCard.click()

    if (variant) {
      const variantButton = page.getByRole('button', { name: variant })
      await variantButton.waitFor({ state: 'visible' })
      await variantButton.click()
    }

    const addToCartButton = page.getByRole('button', { name: 'Add to Cart' })
    await expect(addToCartButton).toBeVisible()
    await addToCartButton.click()

    const cartCount = page.locator('button[data-slot="sheet-trigger"] span').last()
    await expect(cartCount).toHaveText('1')
    await cartCount.click()

    const productInCart = page.getByRole('dialog').getByText(productName, { exact: false })
    await expect(productInCart).toBeVisible()
  }

  async function removeFromCartAndConfirm(page: Page) {
    const reduceQuantityButton = page.getByRole('button', { name: 'Reduce item quantity' })
    await expect(reduceQuantityButton).toBeVisible()
    await reduceQuantityButton.click()

    const emptyCartMessage = page.getByText('Your cart is empty.')
    await expect(emptyCartMessage).toBeVisible()
  }

  async function checkoutWithWayForPaySandbox(
    _page: Page,
    _guestEmail?: string | null,
  ): Promise<void> {
    throw new Error(
      'Configure a WayForPay sandbox merchant before enabling this provider E2E test.',
    )
  }

  async function expectOrderIsDisplayed(page: Page): Promise<void> {
    const orderHeader = await page.locator('h1.text-sm.uppercase.font-mono > span').textContent()
    expect(orderHeader).toContain('Order #')

    const orderNumber = orderHeader?.replace(/^Order #/, '').trim()
    const pageURL = page.url()

    expect(pageURL).toContain(`/orders/${orderNumber}`)
  }

  async function saveAndConfirmSuccess(page: Page) {
    const saveButton = page.locator('#action-save')
    await saveButton.click()

    const successMessage = page.locator('text=Updated successfully')
    await expect(successMessage).toBeVisible()
  }
})
