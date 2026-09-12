'use client';
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {cn} from '@/lib/utils';

const Popover=PopoverPrimitive.Root;
const PopoverTrigger=PopoverPrimitive.Trigger;
const PopoverAnchor=PopoverPrimitive.Anchor;

function PopoverContent({className,align='start',sideOffset=6,...props}:React.ComponentProps<typeof PopoverPrimitive.Content>){
 return <PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
   data-slot="popover-content"
   align={align}
   sideOffset={sideOffset}
   className={cn('z-[1000] w-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-[0_18px_50px_rgba(67,43,28,.18)] outline-none',className)}
   {...props}/>
 </PopoverPrimitive.Portal>;
}

export {Popover,PopoverTrigger,PopoverAnchor,PopoverContent};
