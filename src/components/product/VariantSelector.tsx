'use client'

import { Button } from '@/components/ui/button'
import type { Product } from '@/payload-types'
import { createUrl } from '@/utilities/createUrl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function VariantSelector({ product }: { product: Product }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const variants =
    product.productType === 'configurable'
      ? product.variants?.filter((variant): variant is Product => typeof variant === 'object')
      : undefined

  if (!variants?.length) return null

  return (
    <div className="flex flex-wrap gap-3">
      {variants.map((variant) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('variant', String(variant.id))
        const isActive = searchParams.get('variant') === String(variant.id)
        const isAvailable = variant.stockStatus !== 'out_stock' && (variant.stock ?? 0) > 0

        return (
          <Button
            aria-disabled={!isAvailable}
            className={isActive ? 'bg-primary/5 text-primary' : undefined}
            disabled={!isAvailable}
            key={variant.id}
            onClick={() => router.replace(createUrl(pathname, params), { scroll: false })}
            title={`${variant.title}${!isAvailable ? ' (Out of Stock)' : ''}`}
            variant="ghost"
          >
            {variant.title}
          </Button>
        )
      })}
    </div>
  )
}
