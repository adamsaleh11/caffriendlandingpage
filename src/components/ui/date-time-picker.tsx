'use client';
import * as React from 'react';
import {DatePicker} from './date-picker';
import {TimePicker} from './time-picker';
import {cn} from '@/lib/utils';

const split=(value:string)=>{const [date='',time='']=value.split('T');return {date,time:time.slice(0,5)};};

/**
 * Value and onChange speak the `YYYY-MM-DDTHH:mm` string the old
 * `datetime-local` inputs produced, so callers and the API are untouched.
 */
export function DateTimePicker({value,defaultValue='',onChange,name,required,disabled,fromToday=true,'aria-label':ariaLabel,className}:{
 value?:string;defaultValue?:string;onChange?:(next:string)=>void;name?:string;required?:boolean;disabled?:boolean;fromToday?:boolean;'aria-label'?:string;className?:string;
}){
 const [inner,setInner]=React.useState(defaultValue);
 const current=value!==undefined?value:inner;
 const parts=split(current);
 const emit=(date:string,time:string)=>{const next=date&&time?`${date}T${time}`:'';if(value===undefined)setInner(next);onChange?.(next);};
 return <div className={cn('flex flex-wrap gap-2 [&>*]:min-w-[9rem] [&>*]:flex-1',className)}>
  <DatePicker aria-label={ariaLabel?`${ariaLabel} date`:'Date'} value={parts.date} disabled={disabled} fromToday={fromToday} onChange={date=>emit(date,parts.time||'09:00')}/>
  <TimePicker aria-label={ariaLabel?`${ariaLabel} time`:'Time'} value={parts.time} disabled={disabled} onChange={time=>emit(parts.date,time)}/>
  {name&&<input type="hidden" name={name} value={current}/>}
  {required&&<input className="select-required-shim" tabIndex={-1} aria-hidden="true" required value={current} onChange={()=>{}}/>}
 </div>;
}
