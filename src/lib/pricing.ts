type ProductPrice = {
  price?: null | number
  specialPrice?: null | number
}

type CartItem = {
  product: { id: number | string } | number | string
  quantity?: null | number
}

export const getProductPrice = ({ price, specialPrice }: ProductPrice): number | undefined => {
  if (typeof specialPrice === 'number') {
    return specialPrice
  }

  return typeof price === 'number' ? price : undefined
}

export const calculateCartSubtotal = async (
  items: CartItem[],
  findProduct: (id: number | string) => Promise<ProductPrice>,
): Promise<number> => {
  let subtotal = 0

  for (const item of items) {
    const productID = typeof item.product === 'object' ? item.product.id : item.product
    const product = await findProduct(productID)
    const price = getProductPrice(product)

    if (typeof price !== 'number') {
      throw new Error(`Product ${productID} does not have a checkout price.`)
    }

    subtotal += price * (item.quantity ?? 1)
  }

  return subtotal
}
