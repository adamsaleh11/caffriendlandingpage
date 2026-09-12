'use client';
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import {CheckIcon,ChevronDownIcon,ChevronUpIcon} from 'lucide-react';
import {cn} from '@/lib/utils';

const Select=SelectPrimitive.Root;
const SelectGroup=SelectPrimitive.Group;
const SelectValue=SelectPrimitive.Value;

function SelectTrigger({className,children,...props}:React.ComponentProps<typeof SelectPrimitive.Trigger>){
 return <SelectPrimitive.Trigger
  data-slot="select-trigger"
  className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-[0.95rem] font-normal text-foreground shadow-sm outline-none transition-colors data-[placeholder]:text-muted-foreground hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',className)}
  {...props}>
  {children}
  <SelectPrimitive.Icon asChild><ChevronDownIcon className="size-4 shrink-0 opacity-60"/></SelectPrimitive.Icon>
 </SelectPrimitive.Trigger>;
}

function SelectContent({className,children,position='popper',...props}:React.ComponentProps<typeof SelectPrimitive.Content>){
 return <SelectPrimitive.Portal>
  <SelectPrimitive.Content
   data-slot="select-content"
   position={position}
   className={cn('relative z-[1000] max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_18px_50px_rgba(67,43,28,.18)]',position==='popper'&&'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',className)}
   {...props}>
   <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center"><ChevronUpIcon className="size-4 opacity-60"/></SelectPrimitive.ScrollUpButton>
   <SelectPrimitive.Viewport className={cn('p-1',position==='popper'&&'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}>{children}</SelectPrimitive.Viewport>
   <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center"><ChevronDownIcon className="size-4 opacity-60"/></SelectPrimitive.ScrollDownButton>
  </SelectPrimitive.Content>
 </SelectPrimitive.Portal>;
}

function SelectLabel({className,...props}:React.ComponentProps<typeof SelectPrimitive.Label>){
 return <SelectPrimitive.Label className={cn('px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',className)} {...props}/>;
}

function SelectItem({className,children,...props}:React.ComponentProps<typeof SelectPrimitive.Item>){
 return <SelectPrimitive.Item
  data-slot="select-item"
  className={cn('relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-3 pr-8 text-[0.95rem] outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',className)}
  {...props}>
  <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  <span className="absolute right-2 flex size-4 items-center justify-center"><SelectPrimitive.ItemIndicator><CheckIcon className="size-4 text-primary"/></SelectPrimitive.ItemIndicator></span>
 </SelectPrimitive.Item>;
}

function SelectSeparator({className,...props}:React.ComponentProps<typeof SelectPrimitive.Separator>){
 return <SelectPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border',className)} {...props}/>;
}

export {Select,SelectGroup,SelectValue,SelectTrigger,SelectContent,SelectLabel,SelectItem,SelectSeparator};
