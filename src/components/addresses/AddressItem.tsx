'use client'

import React from 'react'
import type { Address } from '@/payload-types'

type Props = {
  address: Partial<Omit<Address, 'country'>> & { country?: string } // Allow address to be partial and entirely optional as this is entirely for display purposes
  /** Retained for compatibility with order displays. Saved-address actions were removed. */
  hideActions?: boolean
}

export const AddressItem: React.FC<Props> = ({ address }) => {
  if (!address) {
    return null
  }

  return (
    <div className="flex items-center">
      <div className="grow">
        <p className="font-medium">
          {address.title && <span>{address.title} </span>}
          {address.firstName} {address.lastName}
        </p>
        <p>{address.company && <span>{address.company} </span>}</p>
        <p>{address.phone && <span>{address.phone}</span>}</p>
        <p>
          {address.addressLine1}
          {address.addressLine2 && <>, {address.addressLine2}</>}
        </p>
        <p>
          {address.city}, {address.state} {address.postalCode}
        </p>
        <p>{address.country}</p>
      </div>
    </div>
  )
}
