'use client';
import * as React from 'react';
import {ClockIcon} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from './popover';
import {cn} from '@/lib/utils';

const HOURS=Array.from({length:12},(_,index)=>index+1);
const MINUTES=Array.from({length:12},(_,index)=>index*5);
const MERIDIEMS=['AM','PM'] as const;

function split(value:string){
 const match=/^(\d{1,2}):(\d{2})$/.exec(value);
 if(!match)return null;
 const hour24=Number(match[1]);const minute=Number(match[2]);
 if(hour24>23||minute>59)return null;
 return {hour:hour24%12===0?12:hour24%12,minute,meridiem:hour24<12?'AM':'PM' as 'AM'|'PM'};
}
function join(hour:number,minute:number,meridiem:'AM'|'PM'){
 const hour24=meridiem==='AM'?hour%12:hour%12+12;
 return `${String(hour24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

/** Value and onChange speak the 24-hour `HH:mm` strings the outreach drafts already use. */
export function TimePicker({value,onChange,id,placeholder='Pick a time',disabled,name,required,'aria-label':ariaLabel,className}:{value:string;onChange:(next:string)=>void;id?:string;placeholder?:string;disabled?:boolean;name?:string;required?:boolean;'aria-label'?:string;className?:string}){
 const [open,setOpen]=React.useState(false);
 const parts=split(value);
 const label=parts?`${parts.hour}:${String(parts.minute).padStart(2,'0')} ${parts.meridiem}`:placeholder;
 const set=(patch:Partial<{hour:number;minute:number;meridiem:'AM'|'PM'}>)=>{
  const base=parts??{hour:9,minute:0,meridiem:'AM' as const};
  const next={...base,...patch};
  onChange(join(next.hour,next.minute,next.meridiem));
 };
 const column=(items:readonly (string|number)[],active:string|number|undefined,pick:(item:never)=>void,render:(item:never)=>string)=>
  <ul className="flex max-h-56 w-16 flex-col gap-1 overflow-y-auto p-1" role="listbox">
   {items.map(item=><li key={String(item)}>
    <button
     type="button"
     role="option"
     aria-selected={item===active}
     onClick={()=>pick(item as never)}
     className={cn('w-full rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent',item===active&&'bg-primary text-primary-foreground hover:bg-primary')}>
     {render(item as never)}
    </button>
   </li>)}
  </ul>;
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
   <button
    id={id}
    type="button"
    data-slot="picker-trigger"
    disabled={disabled}
    aria-label={ariaLabel}
    data-empty={!parts||undefined}
    className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-[0.95rem] font-normal text-foreground shadow-sm outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[empty]:text-muted-foreground',className)}>
    <span className="truncate">{label}</span>
    <ClockIcon className="size-4 shrink-0 opacity-60"/>
   </button>
  </PopoverTrigger>
  <PopoverContent className="p-1">
   <div className="flex divide-x divide-border">
    {column(HOURS,parts?.hour,(hour:number)=>set({hour}),(hour:number)=>String(hour))}
    {column(MINUTES,parts?.minute,(minute:number)=>set({minute}),(minute:number)=>String(minute).padStart(2,'0'))}
    {column(MERIDIEMS,parts?.meridiem,(meridiem:'AM'|'PM')=>set({meridiem}),(meridiem:string)=>meridiem)}
   </div>
  </PopoverContent>
  {name&&<input type="hidden" name={name} value={value}/>}
  {required&&<input className="select-required-shim" tabIndex={-1} aria-hidden="true" required value={value} onChange={()=>{}}/>}
 </Popover>;
}
