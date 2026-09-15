'use client';
import * as React from 'react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './select';

export type SelectOption={value:string;label:string;disabled?:boolean};

/**
 * A shadcn Select that still behaves like a native one inside our plain forms:
 * a hidden input carries the value to FormData, and an offscreen mirror input
 * carries `required` so an empty choice is still reported by the browser.
 * Radix rejects an empty option value, so the placeholder stands in for it.
 */
export function FormSelect({name,value,defaultValue='',onValueChange,options,placeholder,required,disabled,id,'aria-label':ariaLabel,className}:{
 name?:string;value?:string;defaultValue?:string;onValueChange?:(next:string)=>void;options:SelectOption[];placeholder?:string;required?:boolean;disabled?:boolean;id?:string;'aria-label'?:string;className?:string;
}){
 const [inner,setInner]=React.useState(defaultValue);
 const current=value!==undefined?value:inner;
 const change=(next:string)=>{if(value===undefined)setInner(next);onValueChange?.(next);};
 const choices=options.filter(option=>option.value!=='');
 const empty=options.find(option=>option.value==='');
 return <>
  <Select value={current||undefined} onValueChange={change} disabled={disabled}>
   <SelectTrigger id={id} aria-label={ariaLabel} className={className}><SelectValue placeholder={empty?.label??placeholder??'Choose one'}/></SelectTrigger>
   <SelectContent>{choices.map(option=><SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
  </Select>
  {name&&<input type="hidden" name={name} value={current}/>}
  {required&&<input className="select-required-shim" tabIndex={-1} aria-hidden="true" required value={current} onChange={()=>{}}/>}
 </>;
}
