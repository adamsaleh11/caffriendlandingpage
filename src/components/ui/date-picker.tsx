'use client';
import * as React from 'react';
import {format,parse,isValid} from 'date-fns';
import {CalendarIcon} from 'lucide-react';
import {Calendar} from './calendar';
import {Popover,PopoverContent,PopoverTrigger} from './popover';
import {cn} from '@/lib/utils';

/** Value and onChange speak the ISO calendar-date strings the outreach drafts already use. */
export function DatePicker({value,onChange,id,placeholder='Pick a date',disabled,name,required,'aria-label':ariaLabel,fromToday=true,className}:{value:string;onChange:(next:string)=>void;id?:string;placeholder?:string;disabled?:boolean;name?:string;required?:boolean;'aria-label'?:string;fromToday?:boolean;className?:string}){
 const [open,setOpen]=React.useState(false);
 const parsed=React.useMemo(()=>{if(!value)return undefined;const date=parse(value,'yyyy-MM-dd',new Date());return isValid(date)?date:undefined;},[value]);
 const today=React.useMemo(()=>{const now=new Date();now.setHours(0,0,0,0);return now;},[]);
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
   <button
    id={id}
    type="button"
    data-slot="picker-trigger"
    disabled={disabled}
    aria-label={ariaLabel}
    data-empty={!parsed||undefined}
    className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-[0.95rem] font-normal text-foreground shadow-sm outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[empty]:text-muted-foreground',className)}>
    <span className="truncate">{parsed?format(parsed,'EEE, d MMM yyyy'):placeholder}</span>
    <CalendarIcon className="size-4 shrink-0 opacity-60"/>
   </button>
  </PopoverTrigger>
  <PopoverContent className="p-2">
   <Calendar
    mode="single"
    autoFocus
    selected={parsed}
    defaultMonth={parsed}
    disabled={fromToday?{before:today}:undefined}
    onSelect={date=>{if(!date)return;onChange(format(date,'yyyy-MM-dd'));setOpen(false);}}/>
  </PopoverContent>
  {name&&<input type="hidden" name={name} value={value}/>}
  {required&&<input className="select-required-shim" tabIndex={-1} aria-hidden="true" required value={value} onChange={()=>{}}/>}
 </Popover>;
}
