'use client';
import * as React from 'react';
import {ChevronLeftIcon,ChevronRightIcon} from 'lucide-react';
import {DayPicker} from 'react-day-picker';
import {cn} from '@/lib/utils';

export type CalendarProps=React.ComponentProps<typeof DayPicker>;

function Calendar({className,classNames,showOutsideDays=true,...props}:CalendarProps){
 return <DayPicker
  showOutsideDays={showOutsideDays}
  className={cn('p-1 [--cell:2.25rem]',className)}
  classNames={{
   months:'relative flex flex-col gap-4',
   month:'flex flex-col gap-4',
   month_caption:'flex h-9 items-center justify-center',
   caption_label:'text-sm font-semibold',
   nav:'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
   button_previous:'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent disabled:opacity-40',
   button_next:'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent disabled:opacity-40',
   month_grid:'w-full border-collapse',
   weekdays:'flex',
   weekday:'w-[var(--cell)] text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground',
   week:'mt-1 flex w-full',
   day:'size-[var(--cell)] p-0 text-center',
   day_button:'size-full rounded-lg text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35',
   selected:'[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
   today:'[&>button]:border [&>button]:border-primary/60',
   outside:'text-muted-foreground/60',
   disabled:'opacity-35',
   hidden:'invisible',
   ...classNames,
  }}
  components={{
   Chevron:({orientation,...rest})=>orientation==='left'
    ?<ChevronLeftIcon className="size-4" {...rest}/>
    :<ChevronRightIcon className="size-4" {...rest}/>,
  }}
  {...props}/>;
}

export {Calendar};
